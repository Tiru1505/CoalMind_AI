"""End-to-end API smoke test (resets the database it runs against).

Usage (from backend/):  python scripts/smoke_test.py
Tip: point it at a scratch DB with  DATABASE_URL=sqlite:///./smoke.db
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
from app.database.seed import reset_and_seed  # noqa: E402
from app.main import app  # noqa: E402


def otp_login(c, mobile, role, name=None):
    r = c.post("/api/auth/otp/request", json={"mobile": mobile, "role": role})
    assert r.status_code == 200, r.text
    code = r.json()["demo_otp"]
    r = c.post("/api/auth/otp/verify", json={"mobile": mobile, "role": role, "otp": code, "name": name})
    assert r.status_code == 200, r.text
    j = r.json()
    return {"Authorization": "Bearer " + j["token"]}, j


def main():
    reset_and_seed()
    with TestClient(app) as c:
        # ---------- auth
        r = c.post("/api/auth/otp/request", json={"mobile": "9876500001", "role": "viewer"})
        print("role mismatch ->", r.status_code, r.json()["detail"])
        print("bad mobile ->", c.post("/api/auth/otp/request", json={"mobile": "1234567890", "role": "viewer"}).status_code)
        r = c.post("/api/auth/otp/request", json={"mobile": "9876500003", "role": "management"})
        bad = c.post("/api/auth/otp/verify", json={"mobile": "9876500003", "role": "management", "otp": "000000"})
        print("wrong otp ->", bad.status_code, bad.json()["detail"])
        H, j = otp_login(c, "9876500001", "geological_officer")
        print("officer ->", j["user"]["name"], j["redirect"])
        HN, jn = otp_login(c, "9123456789", "management", name="Kavita Rao")
        print("new user ->", jn["user"]["name"], jn["user"]["role"], jn["redirect"], "created:", jn["created"])

        # ---------- consistency guard before processing
        s = c.get("/api/consistency", headers=H).json()
        print("consistency score", s["score"], "conflicts", [(x["label"], x["mine"], [cl["display"] for cl in x["clusters"]], x["severity"]) for x in s["conflicts"]])

        # ---------- officer golden path
        docs = c.get("/api/documents", headers=H).json()
        gev = next(d for d in docs if d["is_demo_target"])
        p = c.post(f"/api/documents/{gev['id']}/process", headers=H).json()
        print("process ->", p["status"])
        ex = c.get(f"/api/documents/{gev['id']}/extraction", headers=H).json()
        for f in ex["fields"]:
            if f["status"] == "pending":
                c.post(f"/api/validation/{f['id']}/approve", json={}, headers=H)
        a = c.post("/api/ai/query", json={"question": "What was the production of Gevra OC Mine in FY 2024-25?"}, headers=H).json()
        print("AI ->", a["answer"])
        print("   sources", [(x["filename"], x["page"]) for x in a["sources"]], "consistency", a["consistency"] and a["consistency"]["status"])

        # ---------- resolve conflict
        s = c.get("/api/consistency", headers=H).json()
        k = next(x for x in s["conflicts"] if x["mine_code"] == "KUS")
        r = c.post("/api/consistency/resolve", json={"key": k["key"], "value": k["recommended"]["value"],
                                                     "reason": "Mine report and annual summary agree; CIL MIS has a transposition"}, headers=H)
        print("resolve ->", r.status_code, r.json()["status"], "| score now", c.get("/api/consistency", headers=H).json()["score"])
        a = c.post("/api/ai/query", json={"question": "What was the overburden removal of Kusmunda OC Mine in FY 2024-25?"}, headers=H).json()
        print("AI KUS OB ->", a["answer"])

        rep = c.post("/api/reports/generate", json={"report_type": "Annual Mining Report", "scope": "GEV", "financial_year": "2024-25", "sections": []}, headers=H).json()
        print("report checks ->", [x["check"] for x in rep["content"]["validation_checks"]][-1])

        # ---------- isolation
        other_docs = c.get("/api/documents", headers=HN).json()
        other_gev = next(d for d in other_docs if d["is_demo_target"])
        print("isolation: new user's Gevra status ->", other_gev["status"], "| officer doc visible to new user ->",
              c.get(f"/api/documents/{gev['id']}", headers=HN).status_code)
        print("history officer", len(c.get("/api/ai/history", headers=H).json()), "| new user", len(c.get("/api/ai/history", headers=HN).json()))
        print("audit new user ->", [x["action"] for x in c.get("/api/audit-logs", headers=HN).json()])
        print("audit scope=all by management ->", c.get("/api/audit-logs?scope=all", headers=HN).status_code)
        HA, _ = otp_login(c, "9876500002", "admin")
        ov = c.get("/api/admin/overview", headers=HA).json()
        print("admin ->", ov["kpis"]["users"], "users;", [(u["name"], u["documents"], u["queries"]) for u in ov["users"]])
        print("dashboard mgmt ->", c.get("/api/dashboard", headers=HN).json()["consistency"]["open_conflicts"], "open conflicts")
        r = c.post("/api/demo/reset", headers=H).json()
        print("reset own ->", r["scope"], "| officer Gevra ->", next(d for d in c.get("/api/documents", headers=H).json() if d["is_demo_target"])["status"])


if __name__ == "__main__":
    main()
