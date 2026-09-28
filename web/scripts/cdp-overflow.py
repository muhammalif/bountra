#!/usr/bin/env python3
"""Report which elements are widest, to localize a horizontal overflow.

Usage: cdp-overflow.py <port> <path> [width]
"""
import asyncio
import json
import random
import sys

sys.path.insert(0, "/Users/macbookpro/Project/Web3/bountra/web/scripts")
from cdp_lib import Session, launch  # noqa: E402

WIDEST = """(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right <= vw + 1) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    // Report the innermost offenders only; a parent is just inheriting its child.
    if ([...el.children].some(c => c.getBoundingClientRect().right > vw + 1)) return;
    bad.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 110),
      right: Math.round(r.right),
      w: Math.round(r.width),
      text: (el.textContent || '').trim().slice(0, 40)
    });
  });
  return {vw, bad: bad.sort((a, b) => b.right - a.right).slice(0, 10)};
})()"""


async def main() -> int:
    port, path = int(sys.argv[1]), sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 320
    # A fixed port collides with a leftover instance from a previous run.
    debug_port = random.randint(9400, 9600)
    async with Session(launch(debug_port)) as browser:
        target = (await browser.send("Target.createTarget", url="about:blank"))["targetId"]
        base = browser._url.rsplit("/", 1)[0].rsplit("/devtools", 1)[0]
        async with Session(f"{base}/devtools/page/{target}") as page:
            await page.send("Page.enable")
            await page.send("Runtime.enable")
            await page.send("Emulation.setDeviceMetricsOverride",
                            width=width, height=800, deviceScaleFactor=1, mobile=True)
            await page.send("Page.navigate", url=f"http://localhost:{port}{path}")
            await asyncio.sleep(2)
            got = (await page.send("Runtime.evaluate", returnByValue=True, expression=WIDEST))["result"]["value"]
            print(f"viewport {got['vw']}px  path {path}")
            for b in got["bad"]:
                print(f"  right={b['right']:>4} w={b['w']:>4}  <{b['tag']}>  {b['cls']}")
                print(f"                     text: {b['text']!r}")
            if not got["bad"]:
                print("  no element exceeds the viewport")
        await browser.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
