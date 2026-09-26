"""Publish the single-file Allure report to its own Vercel project using the Vercel REST API.

Works with a personal-account token or a team-scoped token (the Vercel CLI needs "who am I" access,
which team tokens don't have). Needs VERCEL_TOKEN; VERCEL_TEAM_ID is optional (found automatically).
Prints the report URL on success and writes it to $GITHUB_OUTPUT as `url`. The token is never printed.

Usage: python3 .github/scripts/publish_report.py allure-report/index.html
"""
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://api.vercel.com"
PROJECT = "stock-trend-test-report"
TOKEN = os.environ["VERCEL_TOKEN"]


def call(method, path, body=None, data=None, headers=None, team=None):
    url = API + path + (("&" if "?" in path else "?") + f"teamId={team}" if team else "")
    hdrs = {"Authorization": f"Bearer {TOKEN}", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def fail(title, message):
    print(f"::error title={title}::{message}")
    sys.exit(1)


def find_team():
    """Team id for a team-scoped token; None for a personal-account token."""
    if os.environ.get("VERCEL_TEAM_ID"):
        return os.environ["VERCEL_TEAM_ID"]
    status, user = call("GET", "/v2/user")
    if status == 200:
        return user.get("user", {}).get("defaultTeamId")          # personal Hobby "team", if any
    status, teams = call("GET", "/v2/teams")
    if status == 200 and teams.get("teams"):
        return teams["teams"][0]["id"]
    status, _ = call("GET", "/v9/projects?limit=1")
    if status == 200:
        fail("Vercel token is limited to specific projects",
             "It can't create the separate report site. Create a token for your whole account or team at "
             "vercel.com/account/settings/tokens and update the VERCEL_TOKEN secret.")
    fail("Vercel token rejected", "Create a new token at vercel.com/account/settings/tokens and update the VERCEL_TOKEN secret.")


def main(path):
    team = find_team()
    blob = open(path, "rb").read()
    sha = hashlib.sha1(blob).hexdigest()

    status, res = call("POST", "/v2/files", data=blob, team=team,
                       headers={"Content-Type": "application/octet-stream", "x-vercel-digest": sha, "Content-Length": str(len(blob))})
    if status != 200:
        fail("Report upload failed", f"HTTP {status}: {res.get('error', {}).get('message', '')}")

    status, dep = call("POST", "/v13/deployments?skipAutoDetectionConfirmation=1", team=team, body={
        "name": PROJECT,
        "target": "production",
        "files": [{"file": "index.html", "sha": sha, "size": len(blob)}],
        "projectSettings": {"framework": None, "buildCommand": None, "installCommand": None, "outputDirectory": None},
    })
    if status not in (200, 201):
        fail("Report deployment failed", f"HTTP {status}: {dep.get('error', {}).get('message', '')}")

    for _ in range(60):                                            # wait until the deployment is live
        status, dep = call("GET", f"/v13/deployments/{dep['id']}", team=team)
        if dep.get("readyState") in ("READY", "ERROR", "CANCELED"):
            break
        time.sleep(5)
    if dep.get("readyState") != "READY":
        fail("Report deployment did not finish", f"state: {dep.get('readyState')}")

    # Prefer the stable production address (e.g. stock-trend-test-report.vercel.app) over the per-deploy URL.
    status, proj = call("GET", f"/v9/projects/{PROJECT}", team=team)
    aliases = (proj.get("targets", {}).get("production", {}) or {}).get("alias") or dep.get("alias") or []
    stable = sorted((a for a in aliases if a.endswith(".vercel.app")), key=len)
    url = "https://" + (stable[0] if stable else dep["url"])
    print(f"::notice title=Allure report::{url}")
    print(f"Allure report published: {url}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
            fh.write(f"url={url}\n")


if __name__ == "__main__":
    main(sys.argv[1])
