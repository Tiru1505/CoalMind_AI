import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app

with TestClient(app) as c:
    r = c.post("/api/auth/login", json={"employee_id": "CMPDI001", "password": "demo123"}); assert r.status_code == 200, r.text
    H = {"Authorization": "Bearer " + r.json()["token"]}
    c.post("/api/demo/reset", headers=H)
    d = c.get("/api/dashboard", headers=H).json()
    print("KPIs", [(k["label"], k["value"]) for k in d["kpis"]])
    def ask(q):
        a = c.post("/api/ai/query", json={"question": q}, headers=H).json()
        print("\nQ:", q, "| intent", a["intent"], "| grounded", a["grounded"])
        print("A:", a["answer"])
        for s in a["sources"]: print("   -", s["filename"], "p", s["page"], s["relevance"], "|", s["snippet"][:90])
        return a
    ask("What was the production of Gevra OC Mine in FY 2024-25?")
    docs = c.get("/api/documents", headers=H).json()
    gev = next(x for x in docs if x["is_demo_target"])
    p = c.post(f"/api/documents/{gev['id']}/process", headers=H).json()
    print("\nPROCESS", p["status"]); [print("  ", s["name"], s["status"], s["detail"]) for s in p["stages"]]
    ex = c.get(f"/api/documents/{gev['id']}/extraction", headers=H).json()
    for f in ex["fields"]: print("  F", f["label"], f["value"], f["unit"], f["confidence"], f["status"], f["page"])
    print("  NORM", ex["normalization"])
    land = next(f for f in ex["fields"] if f["key"] == "land_reclaimed")
    print("edit", c.post(f"/api/validation/{land['id']}/edit", json={"value": "142"}, headers=H).status_code)
    print("approve", c.post(f"/api/validation/{land['id']}/approve", json={}, headers=H).json()["status"])
    ask("What was the production of Gevra OC Mine in FY 2024-25?")
    ask("Which mines exceeded their production targets?")
    ask("What was the land reclamation progress in 2025?")
    ask("Show the trend of coal production over the last 5 years.")
    ask("Prepare a summary of Kusmunda mine.")
    ask("Compare Gevra and Dipka in FY 2024-25")
    ask("What are the geological reserves of Gevra?")
    ask("गेवरा खदान का वित्त वर्ष 2024-25 में कोयला उत्पादन कितना था?")
    ask("What is the price of coal in Japan?")
    ask("How much land did Gevra reclaim in FY 2024-25?")
    ask("dust suppression measures")
    s = c.get("/api/knowledge/search", params={"q": "Gevra"}, headers=H).json()
    print("\nKB search", s["count"], [(x["document_title"], x["page"], x["relevance"]) for x in s["results"]])
    print("KB stats", {k: v for k, v in c.get("/api/knowledge/stats", headers=H).json().items() if isinstance(v, int)})
    t = c.get("/api/topics", headers=H).json(); print("topics", len(t["topics"]), t["trend"][0])
    print("topic detail", c.get("/api/topics/land-reclamation", headers=H).json()["statistics"])
    rep = c.post("/api/reports/generate", json={"report_type": "Annual Mining Report", "scope": "GEV", "financial_year": "2024-25", "sections": []}, headers=H)
    print("report", rep.status_code, rep.json()["title"], len(rep.json()["content"]["references"]), rep.json()["content"]["validation_checks"])
    print("analytics", c.get("/api/analytics", headers=H).json()["summary"])
    print("export", c.get("/api/analytics/export?format=xlsx", headers=H).status_code)
    logs = c.get("/api/audit-logs", headers=H).json(); print("audit", len(logs)); [print("  ", l["user"], "|", l["action"], "|", l["status"]) for l in logs[:12]]
    print("notif", c.get("/api/notifications", headers=H).json()["items"][:3])
    print("search", c.get("/api/search?q=gevra", headers=H).json()[:4])
    print("bad upload", c.post("/api/documents/upload", files={"file": ("x.pdf", b"hello", "application/pdf")}, headers=H).json())
    print("good upload", c.post("/api/documents/upload", files={"file": ("Dipka_Production_Report_FY2024-25.pdf", b"%PDF-1.4 /Type /Page /Font", "application/pdf")}, headers=H).json()["status"])
    fail = next(x for x in docs if x["status"] == "Failed")
    print("failed proc", c.post(f"/api/documents/{fail['id']}/process", headers=H).json()["status"])
    r = c.post("/api/auth/login", json={"employee_id": "VIEW001", "password": "demo123"}); HV = {"Authorization": "Bearer " + r.json()["token"]}
    print("viewer ai", c.post("/api/ai/query", json={"question": "x"}, headers=HV).status_code)
