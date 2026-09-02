import re
from typing import List, Dict, Any, Set
from app.models.entity import EntityType

# Common Indian Context Vocabularies
KNOWN_LOCATIONS = {
    "Delhi", "New Delhi", "Connaught Place", "Dwarka", "Rohini", "Saket", "IGI Airport",
    "Mumbai", "Bandra", "Andheri", "Colaba", "Dharavi", "Navi Mumbai", "Thane",
    "Pune", "Shivajinagar", "Hinjawadi", "Kothrud", "Hadapsar",
    "Bengaluru", "Bangalore", "Whitefield", "Koramangala", "Indiranagar", "Electronic City",
    "Hyderabad", "Cyberabad", "Secunderabad", "Banjara Hills", "Hitec City",
    "Kolkata", "Howrah", "Salt Lake", "Park Street",
    "Chennai", "T Nagar", "Anna Nagar", "Adyar",
    "Ahmedabad", "Surat", "Vadodara", "Jaipur", "Lucknow", "Chandigarh", "Noida", "Gurgaon", "Gurugram"
}

KNOWN_ORGANIZATIONS = {
    "State Bank of India", "SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Punjab National Bank", "PNB",
    "Airtel", "Bharti Airtel", "Reliance Jio", "Jio", "Vodafone Idea", "Vi", "BSNL",
    "Reserve Bank of India", "RBI", "SEBI", "CCTNS", "NATGRID", "CrPI", "CBI", "ED", "NIA",
    "Apex Global Trading", "Vikas Exports Ltd", "Golden Horizon Hawala", "Silverline Enterprises",
    "Om Logistics", "Delta Financial Services", "Shadow Syndicate Corp", "Evergreen Shell Ltd"
}

INDIAN_FIRST_NAMES = {
    "Vikram", "Vikas", "Rajesh", "Rahul", "Amit", "Suresh", "Ramesh", "Anil", "Sunil", "Pooja",
    "Priya", "Ananya", "Rohan", "Sanjay", "Deepak", "Manoj", "Ajay", "Vijay", "Chaitanya", "Suyash",
    "Neha", "Kavita", "Ritu", "Sneha", "Karan", "Arjun", "Manish", "Gaurav", "Sachin", "Alok"
}

INDIAN_LAST_NAMES = {
    "Malhotra", "Patel", "Sharma", "Verma", "Gupta", "Deshmukh", "Kumar", "Singh", "Joshi", "Kulkarni",
    "Ghodake", "Reddy", "Rao", "Nair", "Iyer", "Mehra", "Kapoor", "Bose", "Banerjee", "Das", "Agarwal"
}

def extract_entities_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Named Entity Recognition (NER) pipeline tailored to Indian law enforcement synthetic dossiers.
    Extracts:
    1. PHONE: Indian 10-digit mobile numbers (+91 / 0 / raw)
    2. VEHICLE: Indian RTO vehicle registration numbers
    3. LOCATION: Cities, districts, landmarks, and cell towers
    4. ORGANIZATION: Banks, shell entities, telcos, government agencies
    5. PERSON: Suspects, witnesses, complainants, and officers
    6. EVENT: Wire transfers, calls, meetings, raids, FIR registrations
    """
    if not text or not text.strip():
        return []

    entities: List[Dict[str, Any]] = []
    seen_keys: Set[str] = set()

    def add_entity(name: str, entity_type: EntityType, canonical_name: str, confidence: float, attributes: Dict[str, Any]):
        key = f"{entity_type.value}:{canonical_name.lower().strip()}"
        if key not in seen_keys and len(name.strip()) > 1:
            seen_keys.add(key)
            entities.append({
                "name": name.strip(),
                "entity_type": entity_type,
                "canonical_name": canonical_name.strip(),
                "confidence_score": round(confidence, 2),
                "attributes_json": attributes
            })

    # 1. PHONE NUMBERS (+91-9876543210, 09876543210, 9876543210)
    phone_pattern = r'(?:(?:\+91[\-\s]?)|(?:0))?([6-9]\d{9})'
    for match in re.finditer(phone_pattern, text):
        raw_phone = match.group(0).strip()
        standard_phone = match.group(1).strip()
        canonical = f"+91-{standard_phone}"
        add_entity(
            name=raw_phone,
            entity_type=EntityType.PHONE,
            canonical_name=canonical,
            confidence=0.95,
            attributes={"normalized_number": standard_phone, "country_code": "+91"}
        )

    # 2. VEHICLE REGISTRATION (e.g. MH12AB1234, DL-01-C-4567, KA05MB9988, GJ01XY7890)
    vehicle_pattern = r'\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4})\b'
    for match in re.finditer(vehicle_pattern, text):
        raw_veh = match.group(1).strip()
        clean_veh = re.sub(r'[-\s]', '', raw_veh).upper()
        # Form canonical e.g. DL-01-AB-1234
        if len(clean_veh) >= 9:
            canonical = f"{clean_veh[:2]}-{clean_veh[2:4]}-{clean_veh[4:-4]}-{clean_veh[-4:]}"
        else:
            canonical = clean_veh
        add_entity(
            name=raw_veh,
            entity_type=EntityType.VEHICLE,
            canonical_name=canonical,
            confidence=0.90,
            attributes={"rto_state": clean_veh[:2], "normalized_plate": clean_veh}
        )

    # 3. LOCATIONS (Dictionary + Cell Tower Heuristics)
    for loc in KNOWN_LOCATIONS:
        pattern = r'\b' + re.escape(loc) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            add_entity(
                name=loc,
                entity_type=EntityType.LOCATION,
                canonical_name=loc,
                confidence=0.88,
                attributes={"category": "city_or_landmark"}
            )

    tower_pattern = r'\b(TOWER[_\-\s][A-Z0-9_\-]+)\b'
    for match in re.finditer(tower_pattern, text, re.IGNORECASE):
        tower_name = match.group(1).strip().upper()
        add_entity(
            name=tower_name,
            entity_type=EntityType.LOCATION,
            canonical_name=tower_name,
            confidence=0.92,
            attributes={"category": "telecom_cell_tower"}
        )

    # 4. ORGANIZATIONS
    for org in KNOWN_ORGANIZATIONS:
        pattern = r'\b' + re.escape(org) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            add_entity(
                name=org,
                entity_type=EntityType.ORGANIZATION,
                canonical_name=org,
                confidence=0.89,
                attributes={"category": "financial_or_corporate"}
            )

    # 5. PERSONS (Prefixes + Name Pairs)
    person_prefix_pattern = r'\b(?:Accused|Suspect|Witness|Complainant|Inspector|Officer|Mr\.|Ms\.|Shri|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
    for match in re.finditer(person_prefix_pattern, text):
        full_name = match.group(1).strip()
        add_entity(
            name=full_name,
            entity_type=EntityType.PERSON,
            canonical_name=full_name,
            confidence=0.85,
            attributes={"detection_source": "honorific_prefix"}
        )

    # Known Indian First + Last Name cross-product
    for first in INDIAN_FIRST_NAMES:
        for last in INDIAN_LAST_NAMES:
            full_combo = f"{first} {last}"
            if re.search(r'\b' + re.escape(full_combo) + r'\b', text, re.IGNORECASE):
                add_entity(
                    name=full_combo,
                    entity_type=EntityType.PERSON,
                    canonical_name=full_combo,
                    confidence=0.92,
                    attributes={"first_name": first, "last_name": last}
                )

    # 6. EVENTS (Wire Transfers, Raids, Arrests, Calls)
    transfer_pattern = r'(?:transferred|deposited|laundered|paid)\s+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)'
    for match in re.finditer(transfer_pattern, text, re.IGNORECASE):
        amount = match.group(1).strip()
        event_name = f"Transaction Rs. {amount}"
        add_entity(
            name=event_name,
            entity_type=EntityType.EVENT,
            canonical_name=event_name,
            confidence=0.80,
            attributes={"amount": amount, "event_type": "financial_transfer"}
        )

    return entities
