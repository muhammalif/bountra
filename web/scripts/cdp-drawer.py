#!/usr/bin/env python3
"""Measure the Claim Bounty drawer while it is actually open.

The drawer is rendered on top of a real bounty row, so a plain page load never
shows it. This drives the DOM to open a real drawer over the production build and
reports geometry, overflow, and tap targets from the rendered result.

Run: python3 scripts/cdp-drawer.py [width]
"""
import asyncio
import json
import random
import sys

sys.path.insert(0, "/Users/macbookpro/Project/Web3/bountra/web/scripts")
from cdp_lib import Session, launch  # noqa: E402

# The explore grid opens the drawer when a bounty row is activated.
OPEN = r"""
(() => {
  const rows = Array.from(document.querySelectorAll('button')).filter(
    b => /view issue & instructions/i.test((b.innerText || '').trim()));
  const row = rows[0];
  if (!row) {
    const any = Array.from(document.querySelectorAll('button')).map(b => (b.innerText||'').trim().slice(0,30));
    return 'no-bounty-row; buttons seen: ' + JSON.stringify(any.slice(0, 25));
  }
  row.click();
  return 'clicked: ' + (row.innerText || '').replace(/\s+/g, ' ').slice(0, 70);
})()
"""

PROBE = r"""
(() => {
  const overlay = document.querySelector('.fixed.inset-0.z-50');
  if (!overlay) return JSON.stringify({ found: false, reason: 'no overlay' });
  const panel = overlay.firstElementChild && overlay.firstElementChild.firstElementChild;
  if (!panel) return JSON.stringify({ found: false, reason: 'no panel' });

  const vw = window.innerWidth;
  const pr = panel.getBoundingClientRect();

  const small = [];
  panel.querySelectorAll('a, button, [role=button], input:not([type=hidden]), select, textarea')
    .forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (Math.min(b.width, b.height) >= 44) return;
      small.push({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.value || '').trim().slice(0, 40),
        w: Math.round(b.width), h: Math.round(b.height),
        // WCAG 2.5.8 exempts a link only when it sits in a sentence, so
        // require the enclosing block to hold text besides this link.
        inline: (() => {
          const block = el.closest('p, li, label');
          if (!block) return false;
          return (block.innerText || '').replace(el.innerText || '', '').trim().length > 0;
        })(),
      });
    });

  const footer = panel.querySelector('.sticky');
  return JSON.stringify({
    found: true,
    viewport: vw,
    panel: { left: Math.round(pr.left), right: Math.round(pr.right), w: Math.round(pr.width) },
    overflowsRight: pr.right > vw + 0.5,
    overflowsLeft: pr.left < -0.5,
    docOverflowX: document.documentElement.scrollWidth - vw,
    hasStickyFooter: !!footer,
    small,
  });
})()
"""


async def open_and_measure(port: int, width: int, session: Session) -> dict:
    await session.send(
        "Emulation.setDeviceMetricsOverride",
        width=width, height=900, deviceScaleFactor=1, mobile=width < 1024,
    )
    await session.send("Page.navigate", url=f"http://localhost:{port}/explore")
    await asyncio.sleep(2.5)
    opened = (await session.send(
        "Runtime.evaluate", returnByValue=True, expression=OPEN
    ))["result"]["value"]
    await asyncio.sleep(0.8)
    res = await session.send("Runtime.evaluate", returnByValue=True, expression=PROBE)
    out = json.loads(res["result"]["value"])
    out["opened"] = opened
    out["width"] = width
    return out


async def main() -> int:
    port = 3000
    widths = [int(sys.argv[1])] if len(sys.argv) > 1 else [390, 768, 1440]
    failures = 0

    async with Session(launch(random.randint(9700, 9799))) as browser:
        base = browser._url.rsplit("/", 1)[0].rsplit("/devtools", 1)[0]
        target = (await browser.send("Target.createTarget", url="about:blank"))["targetId"]
        async with Session(f"{base}/devtools/page/{target}") as page:
            await page.send("Page.enable")
            await page.send("Runtime.enable")
            for w in widths:
                r = await open_and_measure(port, w, page)
                print(f"--- {w}px ---")
                print(f"  opened: {r['opened']}")
                if not r.get("found"):
                    print(f"  FAIL: {r.get('reason')}")
                    failures += 1
                    continue
                print(f"  panel  L={r['panel']['left']} R={r['panel']['right']} w={r['panel']['w']} (vp {r['viewport']})")
                print(f"  overflow right={r['overflowsRight']} left={r['overflowsLeft']} doc={r['docOverflowX']}")
                real = [t for t in r["small"] if not t["inline"]]
                print(f"  sub-44px: {len(r['small'])} total, {len(real)} actionable")
                for t in real:
                    print(f"    FAIL {t['w']}x{t['h']} <{t['tag']}> {t['text']!r}")
                if r["overflowsRight"] or r["overflowsLeft"] or r["docOverflowX"] > 0 or real:
                    failures += 1
        await browser.shutdown()

    print("\nPASS" if not failures else f"\n{failures} width(s) failed")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
