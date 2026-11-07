import csv, re
from datetime import datetime

ISO_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
VALID_MERCHANTS = {'M-101', 'M-202', 'M-303', 'M-404'}
VALID_CHANNELS = {'qr', 'link', 'terminal'}
VALID_EVENT_TYPES = {'CAPTURE', 'FAIL', 'REFUND'}

def parse_iso(ts):
    if not ts or not ISO_REGEX.match(ts):
        return None
    try:
        dt = datetime.strptime(ts, '%Y-%m-%dT%H:%M:%SZ')
        return dt
    except ValueError:
        return None

def parse_amount(val):
    val = val.strip()
    if not re.match(r'^[0-9]+$', val):
        return None
    num = int(val)
    if num <= 0 or num > 9007199254740991:
        return None
    return num

# 1. Attempts
with open('data/payment_attempts.csv', 'r', encoding='utf-8') as f:
    att_rows = list(csv.reader(f))[1:]

last_att_by_id = {}
superseded_attempts = []
blank_att_rows = []
for idx, row in enumerate(att_rows):
    pid = row[0].strip() if len(row) > 0 else ''
    if not pid:
        blank_att_rows.append((idx, row))
    else:
        if pid in last_att_by_id:
            superseded_attempts.append(last_att_by_id[pid])
        last_att_by_id[pid] = (idx, row)

valid_attempts = {}
excluded_final_attempts = []
for pid, (idx, row) in last_att_by_id.items():
    if len(row) != 5:
        excluded_final_attempts.append((pid, row, 'bad cols'))
        continue
    merchant_id = row[1].strip()
    created_at_raw = row[2].strip()
    amount_raw = row[3].strip()
    channel = row[4].strip()
    if merchant_id not in VALID_MERCHANTS or channel not in VALID_CHANNELS:
        excluded_final_attempts.append((pid, row, 'bad merch/chan'))
        continue
    created_at = parse_iso(created_at_raw)
    amount = parse_amount(amount_raw)
    if not created_at or amount is None:
        excluded_final_attempts.append((pid, row, 'bad date/amt'))
        continue
    valid_attempts[pid] = {
        'payment_id': pid,
        'merchant_id': merchant_id,
        'created_at_utc': created_at_raw,
        'created_at_dt': created_at,
        'amount_cents': amount,
        'channel': channel,
    }

# 2. Events
with open('data/payment_events.csv', 'r', encoding='utf-8') as f:
    evt_rows = list(csv.reader(f))[1:]

last_evt_by_id = {}
superseded_events = []
blank_evt_rows = []
for idx, row in enumerate(evt_rows):
    eid = row[0].strip() if len(row) > 0 else ''
    if not eid:
        blank_evt_rows.append((idx, row))
    else:
        if eid in last_evt_by_id:
            superseded_events.append(last_evt_by_id[eid])
        last_evt_by_id[eid] = (idx, row)

valid_events = []
excluded_final_events = []
for eid, (idx, row) in last_evt_by_id.items():
    if len(row) != 5:
        excluded_final_events.append((eid, row, 'bad cols'))
        continue
    pid = row[1].strip()
    etype = row[2].strip()
    eat_raw = row[3].strip()
    amt_raw = row[4].strip()
    if not pid or pid not in valid_attempts or etype not in VALID_EVENT_TYPES:
        excluded_final_events.append((eid, row, 'bad pid/type'))
        continue
    eat = parse_iso(eat_raw)
    if not eat:
        excluded_final_events.append((eid, row, 'bad date'))
        continue
    if etype == 'FAIL':
        if amt_raw != '':
            excluded_final_events.append((eid, row, 'fail with amt'))
            continue
        amt = None
    else:
        amt = parse_amount(amt_raw)
        if amt is None:
            excluded_final_events.append((eid, row, 'bad amt'))
            continue
    if eat < valid_attempts[pid]['created_at_dt']:
        excluded_final_events.append((eid, row, 'before attempt'))
        continue
    valid_events.append({
        'event_id': eid,
        'payment_id': pid,
        'event_type': etype,
        'event_at_utc': eat_raw,
        'event_at_dt': eat,
        'amount_cents': amt,
    })

# 3. Group events by payment_id
events_by_payment = {pid: [] for pid in valid_attempts}
for ev in valid_events:
    events_by_payment[ev['payment_id']].append(ev)

rejected_business_events = []
payments_summary = {}

total_gross_cents = 0
total_refund_cents = 0
captured_count = 0
failed_count = 0
pending_count = 0

for pid, pmt in valid_attempts.items():
    p_events = events_by_payment[pid]
    
    eligible_captures = [
        ev for ev in p_events 
        if ev['event_type'] == 'CAPTURE' and ev['amount_cents'] == pmt['amount_cents']
    ]
    ineligible_captures = [
        ev for ev in p_events
        if ev['event_type'] == 'CAPTURE' and ev['amount_cents'] != pmt['amount_cents']
    ]
    for ic in ineligible_captures:
        rejected_business_events.append((ic['event_id'], pid, f'Capture amount mismatch: event {ic["amount_cents"]} != attempt {pmt["amount_cents"]}'))
        
    selected_capture = None
    if eligible_captures:
        eligible_captures.sort(key=lambda x: (x['event_at_dt'], x['event_id']))
        selected_capture = eligible_captures[0]
        for extra_cap in eligible_captures[1:]:
            rejected_business_events.append((extra_cap['event_id'], pid, 'Duplicate eligible capture'))
            
    has_fail = any(ev['event_type'] == 'FAIL' for ev in p_events)
    if selected_capture:
        status = 'captured'
        captured_count += 1
    elif has_fail:
        status = 'failed'
        failed_count += 1
    else:
        status = 'pending'
        pending_count += 1
        
    refund_events = [ev for ev in p_events if ev['event_type'] == 'REFUND']
    accepted_refund_cents = 0
    accepted_refund_events = []
    
    if status != 'captured':
        for rf in refund_events:
            rejected_business_events.append((rf['event_id'], pid, f'Refund on non-captured payment (status: {status})'))
    else:
        refund_events.sort(key=lambda x: (x['event_at_dt'], x['event_id']))
        remaining_cents = selected_capture['amount_cents']
        for rf in refund_events:
            if rf['event_at_dt'] < selected_capture['event_at_dt']:
                rejected_business_events.append((rf['event_id'], pid, f'Refund before capture ({rf["event_at_utc"]} < {selected_capture["event_at_utc"]})'))
                continue
            if rf['amount_cents'] <= remaining_cents:
                accepted_refund_cents += rf['amount_cents']
                remaining_cents -= rf['amount_cents']
                accepted_refund_events.append(rf)
            else:
                rejected_business_events.append((rf['event_id'], pid, f'Refund exceeds remaining captured amount ({rf["amount_cents"]} > {remaining_cents})'))
                
    gross_cents = selected_capture['amount_cents'] if selected_capture else 0
    net_cents = gross_cents - accepted_refund_cents
    
    total_gross_cents += gross_cents
    total_refund_cents += accepted_refund_cents
    
    payments_summary[pid] = {
        'status': status,
        'gross_cents': gross_cents,
        'accepted_refund_cents': accepted_refund_cents,
        'net_cents': net_cents,
        'selected_capture': selected_capture,
        'accepted_refunds': accepted_refund_events
    }

print('=== OVERALL DATA QUALITY SUMMARY ===')
print(f'Superseded attempts: {len(superseded_attempts)}')
print(f'Blank attempts: {len(blank_att_rows)}')
print(f'Excluded final attempts: {len(excluded_final_attempts)}')
print(f'Superseded events: {len(superseded_events)}')
print(f'Blank events: {len(blank_evt_rows)}')
print(f'Excluded final events: {len(excluded_final_events)}')
print(f'Rejected business events: {len(rejected_business_events)}')
print('=== OVERALL FINANCIAL SUMMARY ===')
print(f'Valid payment attempts: {len(valid_attempts)}')
print(f'Captured attempts: {captured_count}')
print(f'Failed attempts: {failed_count}')
print(f'Pending attempts: {pending_count}')
print(f'Capture rate: {captured_count / len(valid_attempts) * 100:.2f}%')
print(f'Gross captured USD: ${total_gross_cents / 100:.2f}')
print(f'Accepted refunds USD: ${total_refund_cents / 100:.2f}')
print(f'Net captured USD: ${(total_gross_cents - total_refund_cents) / 100:.2f}')

# Breakdown by merchant:
print('=== MERCHANT BREAKDOWN ===')
merchants = sorted(list(VALID_MERCHANTS))
for m in merchants:
    m_pmts = [p for p in valid_attempts.values() if p['merchant_id'] == m]
    m_attempts = len(m_pmts)
    m_captured = sum(1 for p in m_pmts if payments_summary[p['payment_id']]['status'] == 'captured')
    m_gross = sum(payments_summary[p['payment_id']]['gross_cents'] for p in m_pmts)
    m_refund = sum(payments_summary[p['payment_id']]['accepted_refund_cents'] for p in m_pmts)
    m_net = m_gross - m_refund
    print(f'Merchant {m}: Attempts={m_attempts}, Captured={m_captured}, Gross=${m_gross/100:.2f}, Refund=${m_refund/100:.2f}, Net=${m_net/100:.2f}')

