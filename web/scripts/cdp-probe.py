#!/usr/bin/env python3
"""Measure touch targets in a running Next.js app over raw CDP.

Usage: cdp-probe.py [port] [path ...]
Exit code is 1 if any control is under 44px, so it works as a gate.
"""
import asyncio
import json
import sys

from cdp_lib import Session, launch

WIDTHS = [320, 375, 390, 430, 768, 1440]
DEFAULT_PATHS = ["/", "/explore", "/dashboard"]
MIN_TARGET = 44

# Any interactive control a finger has to hit.
SELECTOR = "a, button, [role=button], input:not([type=hidden]), select, textarea"

MEASURE = """(() => {
  const arr = [];
  document.querySelectorAll(%s).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    arr.push({t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 22),
              w: Math.round(r.width), h: Math.round(r.height)});
  });
  return {arr, of: document.documentElement.scrollWidth - document.documentElement.clientWidth};
})()""" % json.dumps(SELECTOR)


async def run(port: int, paths: list[str]) -> int:
    origin = f"http://localhost:{port}"
    async with Session(launch(9333)) as browser:
        target = (await browser.send("Target.createTarget", url="about:blank"))["targetId"]
        # The browser endpoint is /devtools/browser/<id>; the page endpoint is
        # a different path on the same host, not a child of the browser URL.
        base = browser._url.rsplit("/", 1)[0].rsplit("/devtools", 1)[0]
        async with Session(f"{base}/devtools/page/{target}") as page:
            await page.send("Page.enable")
            await page.send("Runtime.enable")

            failures = 0
            print(f"{'viewport':>9}  {'route':<11} {'overflow':>8}  {'<44px':>6}  worst offenders")
            for width in WIDTHS:
                await page.send(
                    "Emulation.setDeviceMetricsOverride",
                    width=width, height=800, deviceScaleFactor=1, mobile=width < 768,
                )
                for path in paths:
                    await page.send("Page.navigate", url=origin + path)
                    # The routes are wallet-gated, so wait for the client render.
                    await asyncio.sleep(1.5)
                    got = (await page.send(
                        "Runtime.evaluate", returnByValue=True, expression=MEASURE
                    ))["result"]["value"]

                    small = sorted(
                        (c for c in got["arr"] if min(c["w"], c["h"]) < MIN_TARGET),
                        key=lambda c: min(c["w"], c["h"]),
                    )
                    failures += len(small)
                    worst = ", ".join(f'{c["t"]}({min(c["w"], c["h"])}px)' for c in small[:4]) or "none"
                    flag = "" if not small and got["of"] == 0 else "  <-- FAIL"
                    print(f'{width:>7}px  {path:<11} {got["of"]:>8}  {len(small):>6}  {worst}{flag}')
                    await asyncio.sleep(0.2)

            print(f"\nTotal controls under {MIN_TARGET}px: {failures}")
            await browser.shutdown()
            return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run(int(sys.argv[1]) if len(sys.argv) > 1 else 9222,
                             sys.argv[2:] or DEFAULT_PATHS)))
