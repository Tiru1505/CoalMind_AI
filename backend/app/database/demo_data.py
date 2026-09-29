"""Static demo dataset for the CoalMind AI prototype.

ALL FIGURES ARE SAMPLE / DEMONSTRATION VALUES. They are chosen to be
realistic in scale for Indian opencast coal mining but are NOT official
CIL / SECL / CMPDI statistics.
"""

FINANCIAL_YEARS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
LATEST_VERIFIED_FY = "2024-25"
PROVISIONAL_FYS = {"2025-26"}

USERS = [
    # employee_id, password, name, role, designation, department, email
    ("CMPDI001", "demo123", "Dr. Anil Sharma", "geological_officer", "Geological Officer", "CMPDI — Geology Division", "anil.sharma@cmpdi.demo"),
    ("ADMIN001", "admin123", "Priya Menon", "admin", "System Administrator", "CMPDI — IT & Systems", "priya.menon@cmpdi.demo"),
    ("MGMT001", "demo123", "R. K. Verma", "management", "General Manager (Planning)", "SECL — Corporate Planning", "rk.verma@secl.demo"),
    ("VIEW001", "demo123", "Neha Kulkarni", "viewer", "Assistant Manager (Survey)", "SECL — Korba Area", "neha.kulkarni@secl.demo"),
]

MINES = [
    # code, name, short, type, subsidiary, area, district, state, coalfield, lease_ha, capacity, aliases
    ("GEV", "Gevra Opencast Mine", "Gevra OC", "Opencast", "SECL", "Gevra Area", "Korba", "Chhattisgarh", "Korba Coalfield", 4184.0, 70.0, ["gevra", "gevra oc", "gevra ocp", "gevra opencast", "गेवरा"]),
    ("KUS", "Kusmunda Opencast Mine", "Kusmunda OC", "Opencast", "SECL", "Kusmunda Area", "Korba", "Chhattisgarh", "Korba Coalfield", 3512.0, 62.5, ["kusmunda", "kusmunda oc", "kusmunda ocp", "कुसमुंडा"]),
    ("DIP", "Dipka Opencast Mine", "Dipka OC", "Opencast", "SECL", "Dipka Area", "Korba", "Chhattisgarh", "Korba Coalfield", 2210.0, 40.0, ["dipka", "dipka oc", "dipka ocp", "दीपका"]),
    ("MNK", "Manikpur Opencast Mine", "Manikpur OC", "Opencast", "SECL", "Korba Area", "Korba", "Chhattisgarh", "Korba Coalfield", 640.0, 6.5, ["manikpur", "manikpur oc", "manikpur ocp", "मानिकपुर"]),
    ("KOR", "Korba Area (UG & OC Group)", "Korba", "Area", "SECL", "Korba Area", "Korba", "Chhattisgarh", "Korba Coalfield", 1890.0, 3.0, ["korba", "korba area", "korba ug", "कोरबा"]),
    ("LAK", "Lakhanpur Opencast Mine", "Lakhanpur OC", "Opencast", "MCL", "Lakhanpur Area", "Jharsuguda", "Odisha", "Ib Valley Coalfield", 1650.0, 25.0, ["lakhanpur", "lakhanpur oc"]),
    ("BHU", "Bhubaneswari Opencast Mine", "Bhubaneswari OC", "Opencast", "MCL", "Jagannath Area", "Angul", "Odisha", "Talcher Coalfield", 1980.0, 40.0, ["bhubaneswari", "bhubaneswari oc"]),
    ("JAY", "Jayant Opencast Mine", "Jayant OC", "Opencast", "NCL", "Jayant Area", "Singrauli", "Madhya Pradesh", "Singrauli Coalfield", 2320.0, 25.0, ["jayant", "jayant oc"]),
]

# code -> fy -> (production MT, target MT, overburden Mm3, land reclaimed ha, manpower, safety incidents)
PRODUCTION = {
    "GEV": {
        "2021-22": (45.2, 45.0, 150.4, 118, 5120, 3),
        "2022-23": (52.5, 52.0, 171.6, 124, 5010, 3),
        "2023-24": (54.2, 53.0, 178.9, 131, 4935, 2),
        "2024-25": (52.4, 55.0, 182.3, 142, 4820, 2),
        "2025-26": (55.8, 57.0, 191.2, 151, 4760, 1),
    },
    "KUS": {
        "2021-22": (36.4, 40.0, 118.5, 84, 3920, 2),
        "2022-23": (42.8, 45.0, 139.2, 92, 3880, 3),
        "2023-24": (50.1, 48.0, 158.4, 101, 3845, 2),
        "2024-25": (51.2, 50.0, 164.7, 108, 3790, 1),
        "2025-26": (53.0, 52.0, 171.3, 116, 3750, 1),
    },
    "DIP": {
        "2021-22": (31.0, 33.0, 92.4, 71, 3410, 2),
        "2022-23": (33.5, 35.0, 101.8, 76, 3365, 2),
        "2023-24": (35.2, 36.0, 108.9, 82, 3320, 1),
        "2024-25": (36.8, 35.0, 114.6, 89, 3280, 1),
        "2025-26": (37.4, 38.0, 117.9, 95, 3240, 2),
    },
    "MNK": {
        "2021-22": (4.6, 5.0, 14.2, 18, 1180, 1),
        "2022-23": (5.1, 5.2, 15.6, 21, 1165, 0),
        "2023-24": (5.6, 5.5, 17.1, 24, 1150, 1),
        "2024-25": (5.9, 6.0, 18.4, 27, 1140, 0),
        "2025-26": (6.2, 6.2, 19.3, 30, 1125, 0),
    },
    "KOR": {
        "2021-22": (2.1, 2.4, 3.1, 9, 2860, 2),
        "2022-23": (2.2, 2.4, 3.3, 10, 2810, 1),
        "2023-24": (2.3, 2.5, 3.4, 11, 2770, 2),
        "2024-25": (2.6, 2.5, 3.8, 13, 2730, 1),
        "2025-26": (2.5, 2.6, 3.7, 14, 2690, 1),
    },
    "LAK": {
        "2021-22": (17.8, 19.0, 38.1, 42, 2150, 1),
        "2022-23": (19.4, 20.0, 41.6, 46, 2120, 2),
        "2023-24": (20.6, 21.0, 44.8, 51, 2090, 1),
        "2024-25": (21.9, 21.5, 47.2, 55, 2060, 1),
        "2025-26": (22.4, 23.0, 48.9, 58, 2040, 1),
    },
    "BHU": {
        "2021-22": (26.1, 27.0, 49.8, 38, 2480, 2),
        "2022-23": (28.9, 29.0, 55.1, 41, 2450, 1),
        "2023-24": (30.4, 31.0, 58.7, 45, 2410, 1),
        "2024-25": (32.2, 32.0, 62.3, 49, 2380, 2),
        "2025-26": (33.1, 34.0, 64.0, 53, 2350, 1),
    },
    "JAY": {
        "2021-22": (19.6, 20.0, 71.2, 35, 3120, 2),
        "2022-23": (20.3, 21.0, 74.9, 38, 3080, 1),
        "2023-24": (21.1, 21.5, 77.5, 41, 3040, 2),
        "2024-25": (22.0, 22.0, 80.6, 44, 3010, 1),
        "2025-26": (22.8, 23.0, 83.1, 47, 2980, 1),
    },
}

# code -> (assessment year, GR MT, extractable MT, seams, avg thickness m, grade, GCV, boreholes, drilling m, max depth m)
GEOLOGY = {
    "GEV": ("2023-24", 1420.6, 912.4, "Seam-III, Seam-IV (Kusmunda Group), Seam-V", 38.5, "G11", 4150, 612, 148300, 280),
    "KUS": ("2024-25", 1104.2, 736.8, "Kusmunda Top, Kusmunda Bottom", 31.2, "G11", 4050, 486, 121700, 260),
    "DIP": ("2023-24", 612.5, 402.1, "Dipka Seam, Lower Kusmunda", 24.6, "G12", 3900, 341, 84200, 220),
    "MNK": ("2022-23", 148.3, 92.6, "Seam-IV, Seam-V", 9.8, "G12", 3850, 162, 31400, 150),
    "KOR": ("2022-23", 212.7, 64.1, "Korba Seam, Upper Rajgamar", 4.2, "G9", 4700, 238, 52900, 340),
    "LAK": ("2023-24", 520.4, 348.0, "Lajkura Seam", 18.4, "G13", 3600, 290, 66300, 190),
    "BHU": ("2023-24", 890.1, 612.3, "Talcher Seam-II, Seam-III", 22.1, "G13", 3550, 402, 95800, 230),
    "JAY": ("2024-25", 402.8, 261.5, "Purewa Top, Purewa Bottom, Turra", 14.3, "G10", 4450, 318, 71200, 210),
}

TOPICS = [
    {
        "slug": "production-output", "name": "Production & Output", "color": "#1d4ed8",
        "description": "Coal production, targets, achievement, dispatch and output performance across mines and financial years.",
        "document_count": 428, "trend_pct": 14.0,
        "yearly": {"2021": 61, "2022": 72, "2023": 84, "2024": 98, "2025": 113},
        "keywords": [("coal production", 100), ("target", 86), ("achievement", 80), ("dispatch", 64), ("MT", 58), ("offtake", 42), ("OMS", 36), ("monthly MIS", 33)],
        "related_mines": ["GEV", "KUS", "DIP", "MNK", "KOR"],
    },
    {
        "slug": "land-reclamation", "name": "Land Reclamation", "color": "#15803d",
        "description": "Technical and biological reclamation of mined-out land, backfilling, plantation and eco-restoration progress.",
        "document_count": 213, "trend_pct": 21.0,
        "yearly": {"2021": 24, "2022": 31, "2023": 39, "2024": 52, "2025": 67},
        "keywords": [("land reclaimed", 100), ("biological reclamation", 82), ("plantation", 77), ("backfilling", 61), ("hectares", 58), ("eco-park", 40), ("saplings", 52), ("topsoil", 34)],
        "related_mines": ["GEV", "KUS", "DIP", "MNK"],
    },
    {
        "slug": "geological-exploration", "name": "Geological Exploration", "color": "#b45309",
        "description": "Exploratory drilling, borehole logging, seam correlation and reserve estimation for existing and new blocks.",
        "document_count": 187, "trend_pct": 9.0,
        "yearly": {"2021": 31, "2022": 34, "2023": 37, "2024": 40, "2025": 45},
        "keywords": [("geological reserves", 100), ("borehole", 84), ("drilling", 80), ("seam thickness", 66), ("GCV", 51), ("grade", 49), ("core recovery", 37), ("stratigraphy", 30)],
        "related_mines": ["GEV", "KUS", "DIP", "KOR"],
    },
    {
        "slug": "safety-compliance", "name": "Safety & Compliance", "color": "#b91c1c",
        "description": "DGMS compliance, reportable incidents, safety audits, slope stability monitoring and statutory returns.",
        "document_count": 164, "trend_pct": 17.0,
        "yearly": {"2021": 22, "2022": 26, "2023": 31, "2024": 39, "2025": 46},
        "keywords": [("safety audit", 100), ("DGMS", 88), ("incident", 74), ("slope stability", 61), ("compliance", 70), ("PPE", 38), ("near miss", 42), ("risk assessment", 47)],
        "related_mines": ["GEV", "KUS", "DIP", "KOR"],
    },
    {
        "slug": "environment", "name": "Environment", "color": "#0f766e",
        "description": "Environmental clearance compliance, air and water quality monitoring, dust suppression and afforestation.",
        "document_count": 132, "trend_pct": 12.0,
        "yearly": {"2021": 19, "2022": 22, "2023": 26, "2024": 30, "2025": 35},
        "keywords": [("environmental clearance", 100), ("PM10", 72), ("dust suppression", 66), ("water sprinkling", 51), ("afforestation", 63), ("effluent", 34), ("noise", 29), ("green belt", 45)],
        "related_mines": ["GEV", "KUS", "DIP"],
    },
    {
        "slug": "manpower-productivity", "name": "Manpower & Productivity", "color": "#6d28d9",
        "description": "Workforce deployment, output per man-shift (OMS), HEMM utilisation and productivity benchmarking.",
        "document_count": 124, "trend_pct": 6.0,
        "yearly": {"2021": 21, "2022": 23, "2023": 24, "2024": 27, "2025": 29},
        "keywords": [("manpower", 100), ("OMS", 81), ("HEMM", 64), ("productivity", 77), ("shift", 40), ("utilisation", 52), ("contractual", 33), ("training", 31)],
        "related_mines": ["GEV", "KUS", "DIP", "KOR", "MNK"],
    },
]

GLOBAL_KEYWORDS = [
    ("Coal", 100), ("Production", 92), ("Mine", 88), ("Overburden", 71), ("Target", 67), ("Geology", 64),
    ("Achievement", 62), ("Safety", 60), ("Reclamation", 58), ("Environment", 55), ("Exploration", 52),
    ("Reserve", 49), ("Seam", 46), ("Drilling", 44), ("Dispatch", 41), ("Stripping Ratio", 38),
    ("Excavation", 36), ("Manpower", 35), ("Compliance", 34), ("Borehole", 33), ("Dump", 31),
    ("Plantation", 29), ("Afforestation", 27), ("GCV", 26), ("OMS", 22), ("HEMM", 21), ("DGMS", 24),
]

# Organisation-wide totals representing the historical archive that is not
# individually loaded into this demo database. Live counts are added on top.
DISPLAY_TOTALS = {
    "documents_processed": 1248,
    "fields_extracted": 38742,
    "pending_validation": 37,
    "reports_generated": 186,
    "ai_queries": 2481,
    "extraction_accuracy": 95.8,
    "knowledge_chunks": 42816,
    "entities": 18392,
    "tables": 7481,
    "verified_records": 31207,
}
