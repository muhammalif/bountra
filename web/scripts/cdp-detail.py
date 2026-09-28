#!/usr/bin/env python3
"""List visible interactive elements under 44px with enough context to judge.

Some sub-44px elements are legitimately inline text links or non-target
wrappers, so report tag/classes/parent rather than a bare count.
"""
import asyncio
import json
import random
import sys

sys.path.insert(0, "/Users/macbookpro/Project/Web3/bountra/web/scripts")
from cdp_lib import Session, launch  # noqa: E402

JS = r"""
(() => {
  const out = [];
  const sel = "a, button, [role=button], input:not([type=hidden]), select, textarea";
  document.querySelectorAll(sel).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    let n = el, hidden = false;
    while (n && n !== document.body) {
      if (getComputedStyle(n).display === "none") { hidden = true; break; }
      n = n.parentElement;
    }
    if (hidden) return;
    if (Math.min(r.width, r.height) >= 44) return;
    const cs = getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase(),
      w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display,
      text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
      cls: (el.className || "").toString().slice(0, 120),
      parent: el.parentElement ? el.parentElement.tagName.toLowerCase() : "",
      parentW: el.parentElement ? Math.round(el.parentElement.getBoundingClientRect().width) : 0,
    });
  });
  return JSON.stringify(out);
})()
"""


async def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    rows = []
    async with Session(launch(random.randint(9600, 9699))) as browser:
        base = browser._url.rsplit("/", 1)[0].rsplit("/devtools", 1)[0]
        target = (await browser.send("Target.createTarget", url="about:blank"))["targetId"]
        async with Session(f"{base}/devtools/page/{target}") as page:
            await page.send("Page.enable")
            await page.send("Runtime.enable")
            for width, route in [(390, "/"), (390, "/explore"), (390, "/dashboard"), (1440, "/dashboard")]:
                await page.send(
                    "Emulation.setDeviceMetricsOverride",
                    width=width, height=900, deviceScaleFactor=1, mobile=width < 1024,
                )
                await page.send("Page.navigate", url=f"http://localhost:{port}{route}")
                await asyncio.sleep(2.5)
                res = await page.send("Runtime.evaluate", returnByValue=True, expression=JS)
                for item in json.loads(res["result"]["value"]):
                    item["route"] = f"{route}@{width}"
                    rows.append(item)
        await browser.shutdown()

    # Dedupe so the same component measured at 4 widths is one row.
    seen, uniq = set(), []
    for r in rows:
        key = (r["tag"], r["text"], r["cls"], r["min"] if "min" in r else min(r["w"], r["h"]))
        if key in seen:
            continue
        seen.add(key)
        r["min"] = min(r["w"], r["h"])
        r.pop("w", None)
        r.pop("h", None)
        uniq.append(r)

    uniq.sort(key=lambda r: (r["route"], r["min"]))
    with open("/tmp/sub44.json", "w") as f:
        json.dump(uniq, f, indent=1)
    print(f"unique sub-44px elements: {len(uniq)} (written to /tmp/sub44.json)")
    for r in uniq:
        print(f"  {r['route']:22} {r['min']:>3}px  <{r['tag']}> "
              f"in <{r['parent']}> w={r['parentW']}  {r['text']!r}")
        print(f"      {r['cls']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
