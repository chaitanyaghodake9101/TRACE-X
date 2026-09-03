/**
 * DEMO / SYNTHETIC ENTITY DATA — NOT REAL ENTITIES OR PERSONS
 * ==============================================================================
 * This file contains strictly synthetic, fictional entity records (people,
 * vehicles, organizations, locations, phone numbers, and timeline events)
 * generated for law enforcement UI/UX evaluation and demonstration purposes.
 * No real persons, active operations, or sensitive agency data are used.
 * ==============================================================================
 */

export interface SyntheticPerson {
  id: string;
  name: string;
  alias?: string;
  role: 'potential_suspect' | 'person_of_interest' | 'associate' | 'witness' | 'informant' | 'victim';
  status: 'under_investigation' | 'surveillance_active' | 'verified' | 'unverified' | 'cleared';
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  age?: number;
  nationality?: string;
  phone_numbers: string[];
  associated_vehicles: string[];
  associated_organizations: string[];
  notes: string;
}

export interface SyntheticVehicle {
  id: string;
  registration_number: string;
  make_model: string;
  vehicle_type: 'Sedan' | 'Commercial Van' | 'Armored Cargo Truck' | 'Luxury SUV' | 'Motorcycle' | 'Container Trailer';
  color: string;
  registered_owner: string;
  link_to_case: string;
  last_seen_location?: string;
  last_seen_timestamp?: string;
  status: 'flagged' | 'seized' | 'under_tracking' | 'cleared';
}

export interface SyntheticOrganization {
  id: string;
  name: string;
  cin_registration?: string;
  org_type: 'Shell Corporate Entity' | 'Export/Import Agency' | 'Banking/Remittance Broker' | 'Cyber Crime Syndicate' | 'Logistics Carrier' | 'Procurement Contractor';
  jurisdiction: string;
  associated_persons: string[];
  suspected_role: string;
  risk_rating: 'high' | 'medium' | 'low';
  registered_address: string;
}

export interface SyntheticLocation {
  id: string;
  name: string;
  location_type: 'Primary Crime Scene' | 'Shell Entity Headquarters' | 'Dry Port / Container Depot' | 'Transit Hub' | 'Suspect Residence' | 'Dead-Drop Location';
  address: string;
  city_region: string;
  coordinates?: { lat: number; lng: number };
  associated_events_count: number;
  security_clearance_needed: boolean;
}

export interface SyntheticPhoneNumber {
  id: string;
  phone_number: string;
  telecom_circle: string;
  subscriber_name: string;
  imei_hash?: string;
  total_calls_intercepted: number;
  associated_person_id?: string;
  associated_person_name?: string;
  tower_locations: string[];
  encryption_flag: boolean;
}

export interface SyntheticCaseEvent {
  id: string;
  title: string;
  event_type: 'Financial Wire Transfer' | 'Encrypted Call Intercept' | 'Surveillance Sight' | 'CCTV Gate Pass' | 'Digital Intrusion Attempt' | 'Informant Meeting';
  timestamp: string;
  description: string;
  involved_entities: string[];
  evidence_reference_id?: string;
  significance: 'critical' | 'high' | 'medium';
}

export interface CaseEntitiesBundle {
  case_id: string;
  people: SyntheticPerson[];
  vehicles: SyntheticVehicle[];
  organizations: SyntheticOrganization[];
  locations: SyntheticLocation[];
  phone_numbers: SyntheticPhoneNumber[];
  events: SyntheticCaseEvent[];
}

export const DEMO_CASE_ENTITIES: Record<string, CaseEntitiesBundle> = {
  // Operation Rupee Trail (Hawala & Shell Network)
  'demo-case-001': {
    case_id: 'demo-case-001',
    people: [
      {
        id: 'p-001-1',
        name: 'Vikram Malhotra',
        alias: 'Vicky Dubai',
        role: 'potential_suspect',
        status: 'under_investigation',
        risk_level: 'critical',
        age: 44,
        nationality: 'Indian',
        phone_numbers: ['+91-9876543210', '+91-9811223344'],
        associated_vehicles: ['DL-01-AB-8841'],
        associated_organizations: ['Vikas Exports Ltd', 'Oceanic Remittance FZE'],
        notes: 'Primary facilitator for hawala cash pooling and bogus export documentation.'
      },
      {
        id: 'p-001-2',
        name: 'Suresh Singhania',
        alias: 'Accountant Babu',
        role: 'associate',
        status: 'surveillance_active',
        risk_level: 'high',
        age: 52,
        nationality: 'Indian',
        phone_numbers: ['+91-9811002233'],
        associated_vehicles: ['DL-04-CX-9920'],
        associated_organizations: ['Vikas Exports Ltd'],
        notes: 'Chartered accountant managing circular invoices and overseas remittance structuring.'
      },
      {
        id: 'p-001-3',
        name: 'Pooja Verma',
        alias: 'Director Pooja',
        role: 'person_of_interest',
        status: 'under_investigation',
        risk_level: 'medium',
        age: 38,
        nationality: 'Indian',
        phone_numbers: ['+91-9822334455'],
        associated_vehicles: [],
        associated_organizations: ['Vikas Exports Ltd', 'Silverline Holdings'],
        notes: 'Nominee director on corporate registrar records with power of attorney.'
      },
      {
        id: 'p-001-4',
        name: 'Confidential Source DEL-09',
        alias: 'Eagle-9',
        role: 'informant',
        status: 'verified',
        risk_level: 'low',
        phone_numbers: ['+91-9899001122'],
        associated_vehicles: [],
        associated_organizations: [],
        notes: 'Provided intelligence regarding lack of physical manufacturing premises.'
      }
    ],
    vehicles: [
      {
        id: 'v-001-1',
        registration_number: 'DL-01-AB-8841',
        make_model: 'Black Executive Sedan',
        vehicle_type: 'Sedan',
        color: 'Metallic Black',
        registered_owner: 'Vikram Malhotra',
        link_to_case: 'Captured on Terminal 3 VIP parking CCTV during departure.',
        last_seen_location: 'Indira Gandhi International Airport, Terminal 3',
        last_seen_timestamp: new Date(Date.now() - 12 * 86400000).toISOString(),
        status: 'flagged'
      },
      {
        id: 'v-001-2',
        registration_number: 'DL-04-CX-9920',
        make_model: 'White Delivery Van',
        vehicle_type: 'Commercial Van',
        color: 'White',
        registered_owner: 'Vikas Exports Ltd',
        link_to_case: 'Used for cash transit between Chandni Chowk and Connaught Place.',
        last_seen_location: 'Central Delhi Financial Corridor',
        last_seen_timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
        status: 'under_tracking'
      }
    ],
    organizations: [
      {
        id: 'org-001-1',
        name: 'Vikas Exports Ltd',
        cin_registration: 'U51909DL2021PLC389102',
        org_type: 'Shell Corporate Entity',
        jurisdiction: 'New Delhi, India',
        associated_persons: ['Vikram Malhotra', 'Suresh Singhania', 'Pooja Verma'],
        suspected_role: 'Paper export entity generating bogus customs clearance invoices.',
        risk_rating: 'high',
        registered_address: 'Flat 402, Ring Road Commercial Complex, Lajpat Nagar, New Delhi'
      },
      {
        id: 'org-001-2',
        name: 'Oceanic Remittance FZE',
        cin_registration: 'FZ-2023-DUBAI-8819',
        org_type: 'Banking/Remittance Broker',
        jurisdiction: 'Dubai Free Zone, UAE',
        associated_persons: ['Vikram Malhotra'],
        suspected_role: 'Receiving hub for international foreign drafts without physical cargo import.',
        risk_rating: 'high',
        registered_address: 'Al Souk Commercial Tower, Level 14, Deira, Dubai'
      }
    ],
    locations: [
      {
        id: 'loc-001-1',
        name: 'Lajpat Nagar Registered Office',
        location_type: 'Shell Entity Headquarters',
        address: 'Flat 402, Ring Road Commercial Complex, Lajpat Nagar-IV',
        city_region: 'South East Delhi',
        coordinates: { lat: 28.5672, lng: 77.2433 },
        associated_events_count: 8,
        security_clearance_needed: false
      },
      {
        id: 'loc-001-2',
        name: 'Terminal 3 VIP Lounge & Gate 14',
        location_type: 'Transit Hub',
        address: 'Indira Gandhi International Airport, Terminal 3 Departures',
        city_region: 'South West Delhi',
        coordinates: { lat: 28.5562, lng: 77.1000 },
        associated_events_count: 3,
        security_clearance_needed: true
      },
      {
        id: 'loc-001-3',
        name: 'Connaught Place Banking Branch',
        location_type: 'Primary Crime Scene',
        address: 'Barakhamba Road Commercial Branch, Connaught Place',
        city_region: 'Central Delhi',
        coordinates: { lat: 28.6315, lng: 77.2167 },
        associated_events_count: 5,
        security_clearance_needed: false
      }
    ],
    phone_numbers: [
      {
        id: 'ph-001-1',
        phone_number: '+91-9876543210',
        telecom_circle: 'Delhi-NCR',
        subscriber_name: 'Vikram Malhotra',
        imei_hash: '862094048819201',
        total_calls_intercepted: 142,
        associated_person_id: 'p-001-1',
        associated_person_name: 'Vikram Malhotra',
        tower_locations: ['Tower B4 - Connaught Place', 'Tower C2 - Lajpat Nagar'],
        encryption_flag: true
      },
      {
        id: 'ph-001-2',
        phone_number: '+91-9811223344',
        telecom_circle: 'Mumbai / West Coast',
        subscriber_name: 'Hawala Broker Contact B',
        imei_hash: '359128091823904',
        total_calls_intercepted: 42,
        associated_person_name: 'Overseas Hawala Intermediary',
        tower_locations: ['Tower Z1 - Nariman Point, Mumbai'],
        encryption_flag: true
      }
    ],
    events: [
      {
        id: 'ev-001-1',
        title: 'INR 1.45 Cr RTGS Transfer Dispatched',
        event_type: 'Financial Wire Transfer',
        timestamp: new Date(Date.now() - 8 * 86400000).toISOString(),
        description: 'Fund aggregation of INR 1.45 Crores sent from account 40918821 to Vikas Exports Ltd.',
        involved_entities: ['Vikram Malhotra', 'Vikas Exports Ltd', 'Connaught Place Banking Branch'],
        significance: 'critical'
      },
      {
        id: 'ev-001-2',
        title: '42 Encrypted Calls Logged via Tower B4',
        event_type: 'Encrypted Call Intercept',
        timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
        description: 'Repeated burst communications prior to international fund structuring drafts.',
        involved_entities: ['+91-9876543210', '+91-9811223344'],
        significance: 'high'
      },
      {
        id: 'ev-001-3',
        title: 'CCTV Sighting at Terminal 3 VIP Departures',
        event_type: 'CCTV Gate Pass',
        timestamp: new Date(Date.now() - 12 * 86400000).toISOString(),
        description: 'Suspect Vikram Malhotra sighted carrying encrypted briefcase through security check.',
        involved_entities: ['Vikram Malhotra', 'DL-01-AB-8841', 'Terminal 3 VIP Lounge & Gate 14'],
        significance: 'high'
      }
    ]
  },

  // Operation DarkHydra (Healthcare Ransomware)
  'demo-case-002': {
    case_id: 'demo-case-002',
    people: [
      {
        id: 'p-002-1',
        name: 'Handle: ShadowByte_99',
        alias: 'Krypton Operator',
        role: 'potential_suspect',
        status: 'under_investigation',
        risk_level: 'critical',
        phone_numbers: ['+1-555-019-2831'],
        associated_vehicles: [],
        associated_organizations: ['DarkHydra Syndicate'],
        notes: 'Lead ransomware operator deploying DarkHydra v4.2 executable.'
      },
      {
        id: 'p-002-2',
        name: 'Dr. Ramesh Nambiar',
        role: 'victim',
        status: 'verified',
        risk_level: 'low',
        age: 58,
        nationality: 'Indian',
        phone_numbers: ['+91-9810192837'],
        associated_vehicles: ['DL-03-KA-1122'],
        associated_organizations: ['City Memorial Hospital'],
        notes: 'Chief Medical Officer reporting server lockouts and extortive demand.'
      }
    ],
    vehicles: [
      {
        id: 'v-002-1',
        registration_number: 'DL-08-CC-4019',
        make_model: 'Dark Blue Utility Van',
        vehicle_type: 'Commercial Van',
        color: 'Dark Blue',
        registered_owner: 'Unregistered Entity',
        link_to_case: 'Observed conducting WiFi packet capture near Hospital Data Center.',
        status: 'flagged'
      }
    ],
    organizations: [
      {
        id: 'org-002-1',
        name: 'DarkHydra Syndicate',
        org_type: 'Cyber Crime Syndicate',
        jurisdiction: 'Decentralized / Tor Hidden Network',
        associated_persons: ['Handle: ShadowByte_99'],
        suspected_role: 'Ransomware-as-a-Service (RaaS) developer and exfiltration broker.',
        risk_rating: 'high',
        registered_address: 'DarkHydra Onion Portal v3 (Encrypted)'
      }
    ],
    locations: [
      {
        id: 'loc-002-1',
        name: 'Hospital Central Data Center Room 3B',
        location_type: 'Primary Crime Scene',
        address: 'Sector 12 Hospital Complex, Ring Road',
        city_region: 'National Capital Region',
        associated_events_count: 14,
        security_clearance_needed: true
      }
    ],
    phone_numbers: [
      {
        id: 'ph-002-1',
        phone_number: '+1-555-019-2831',
        telecom_circle: 'VOIP International Gateway',
        subscriber_name: 'Virtual Anonymous SIP',
        total_calls_intercepted: 18,
        encryption_flag: true,
        tower_locations: ['Cloud Gateway Frankfurt']
      }
    ],
    events: [
      {
        id: 'ev-002-1',
        title: 'Unauthorized SSH Brute-Force & Privilege Escalation',
        event_type: 'Digital Intrusion Attempt',
        timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
        description: 'Initial access broker exploited unpatched VPN gateway to deploy DarkHydra payload.',
        involved_entities: ['DarkHydra Syndicate', 'Hospital Central Data Center Room 3B'],
        significance: 'critical'
      }
    ]
  },

  // Operation Phantom Cargo (Customs Smuggling)
  'demo-case-003': {
    case_id: 'demo-case-003',
    people: [
      {
        id: 'p-003-1',
        name: 'Tariq Al-Mansoor',
        alias: 'Captain Tariq',
        role: 'potential_suspect',
        status: 'under_investigation',
        risk_level: 'high',
        age: 49,
        nationality: 'Foreign National',
        phone_numbers: ['+971-50-8819201'],
        associated_vehicles: ['MH-02-ZZ-7711'],
        associated_organizations: ['Apex Bullion Logistics'],
        notes: 'Coordinating misdeclared consignment clearance across dry ports.'
      }
    ],
    vehicles: [
      {
        id: 'v-003-1',
        registration_number: 'MH-02-ZZ-7711',
        make_model: 'Heavy Container Hauler 40ft',
        vehicle_type: 'Container Trailer',
        color: 'Orange / White',
        registered_owner: 'Apex Bullion Logistics',
        link_to_case: 'Carrying misdeclared electronics freight under customs seal 4421/B.',
        status: 'seized'
      }
    ],
    organizations: [
      {
        id: 'org-003-1',
        name: 'Apex Bullion Logistics',
        org_type: 'Logistics Carrier',
        jurisdiction: 'Mumbai / Inland Container Depots',
        associated_persons: ['Tariq Al-Mansoor'],
        suspected_role: 'Concealing precious metals in false container partitions.',
        risk_rating: 'high',
        registered_address: 'Port Terminal Logistics Park, Nhava Sheva'
      }
    ],
    locations: [
      {
        id: 'loc-003-1',
        name: 'Inland Container Depot (ICD) Tughlakabad',
        location_type: 'Dry Port / Container Depot',
        address: 'Container Freight Station 4, ICD Tughlakabad',
        city_region: 'South Delhi',
        associated_events_count: 6,
        security_clearance_needed: true
      }
    ],
    phone_numbers: [
      {
        id: 'ph-003-1',
        phone_number: '+971-50-8819201',
        telecom_circle: 'International Maritime Circle',
        subscriber_name: 'Tariq Al-Mansoor',
        total_calls_intercepted: 35,
        encryption_flag: true,
        tower_locations: ['Nhava Sheva Port Tower']
      }
    ],
    events: [
      {
        id: 'ev-003-1',
        title: 'Customs Seal Tampering Discovered',
        event_type: 'Surveillance Sight',
        timestamp: new Date(Date.now() - 21 * 86400000).toISOString(),
        description: 'Physical inspection revealed duplicate fabricated bolt seals.',
        involved_entities: ['Tariq Al-Mansoor', 'MH-02-ZZ-7711', 'Inland Container Depot (ICD) Tughlakabad'],
        significance: 'high'
      }
    ]
  }
};

/**
 * Helper to fetch structured entities for a given case ID,
 * generating dynamic fallback entities if specific case isn't pre-configured.
 */
export const getCaseEntities = (caseId: string, caseTitle?: string): CaseEntitiesBundle => {
  if (DEMO_CASE_ENTITIES[caseId]) {
    return DEMO_CASE_ENTITIES[caseId];
  }

  // Fallback synthetic entity generator for any other case
  const shortId = caseId.slice(-4) || '8841';
  return {
    case_id: caseId,
    people: [
      {
        id: `p-gen-${shortId}-1`,
        name: `Primary Person of Interest (${shortId})`,
        alias: `Subject-${shortId}`,
        role: 'potential_suspect',
        status: 'under_investigation',
        risk_level: 'high',
        age: 39,
        nationality: 'Indian',
        phone_numbers: [`+91-9810${shortId}01`],
        associated_vehicles: [`DL-02-AB-${shortId}`],
        associated_organizations: [`Entity-${shortId} Corp`],
        notes: `Key person of interest identified during intake for ${caseTitle || 'Investigation'}.`
      },
      {
        id: `p-gen-${shortId}-2`,
        name: `Associate Operative (${shortId})`,
        alias: `Contact-${shortId}`,
        role: 'associate',
        status: 'surveillance_active',
        risk_level: 'medium',
        phone_numbers: [`+91-9877${shortId}99`],
        associated_vehicles: [],
        associated_organizations: [`Entity-${shortId} Corp`],
        notes: 'Cross-referenced via call detail record frequency analysis.'
      }
    ],
    vehicles: [
      {
        id: `v-gen-${shortId}-1`,
        registration_number: `DL-02-AB-${shortId}`,
        make_model: 'Dark Metallic SUV',
        vehicle_type: 'Luxury SUV',
        color: 'Dark Grey',
        registered_owner: `Subject-${shortId}`,
        link_to_case: 'Flagged by Automatic Number Plate Recognition (ANPR) cameras.',
        status: 'under_tracking'
      }
    ],
    organizations: [
      {
        id: `org-gen-${shortId}-1`,
        name: `Entity-${shortId} Operations Ltd`,
        cin_registration: `U74999DL2022PTC${shortId}`,
        org_type: 'Shell Corporate Entity',
        jurisdiction: 'National Capital Region',
        associated_persons: [`Primary Person of Interest (${shortId})`],
        suspected_role: 'Paper transaction vehicle flagged in evidentiary audit.',
        risk_rating: 'medium',
        registered_address: `Sector 44, Commercial Hub #${shortId}, New Delhi`
      }
    ],
    locations: [
      {
        id: `loc-gen-${shortId}-1`,
        name: `Operational Hub Sector-${shortId}`,
        location_type: 'Primary Crime Scene',
        address: `Plot ${shortId}, Industrial Phase II`,
        city_region: 'Delhi-NCR',
        associated_events_count: 4,
        security_clearance_needed: false
      }
    ],
    phone_numbers: [
      {
        id: `ph-gen-${shortId}-1`,
        phone_number: `+91-9810${shortId}01`,
        telecom_circle: 'Delhi-NCR Circle',
        subscriber_name: `Primary Person (${shortId})`,
        total_calls_intercepted: 28,
        encryption_flag: true,
        tower_locations: [`Tower Alpha-${shortId}`]
      }
    ],
    events: [
      {
        id: `ev-gen-${shortId}-1`,
        title: 'Initial Intake Surveillance Log',
        event_type: 'Surveillance Sight',
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
        description: 'Subject vehicle registered entering target industrial zone.',
        involved_entities: [`DL-02-AB-${shortId}`, `Operational Hub Sector-${shortId}`],
        significance: 'high'
      }
    ]
  };
};
