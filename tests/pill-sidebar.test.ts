import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SIDEBAR = readFileSync(join(process.cwd(), "src/components/shared/sidebar.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
const CLOCK = readFileSync(join(process.cwd(), "src/components/shared/sidebar-clock.tsx"), "utf8");

/**
 * The navigation is two stacked pills: the wordmark in its own rounded card,
 * the menu in a rounded pill below it, with a gap between and the whole rail
 * floating clear of the page edge.
 */
describe("the rail is two pills", () => {
  it("the aside is a transparent column, not the coloured bar", () => {
    // The colour now lives on the menu pill; the aside just spaces the two.
    expect(SIDEBAR).toMatch(/app-sidebar hidden w-60 shrink-0 flex-col gap-2\.5 bg-transparent p-2\.5 lg:flex/);
    expect(SIDEBAR).not.toMatch(/app-sidebar[^"]*border-r bg-sidebar/);
  });

  it("the logo sits in its own rounded card", () => {
    expect(SIDEBAR).toMatch(/sidebar-head[^"]*rounded-full bg-card/);
  });

  it("the menu pill carries the colour and the rounding", () => {
    expect(SIDEBAR).toMatch(/sidebar-pill[^"]*rounded-\[28px\] bg-sidebar/);
  });

  it("the page behind is muted, so the pills have something to sit against", () => {
    expect(LAYOUT).toMatch(/flex min-h-0 flex-1 bg-muted\/40/);
  });
});

describe("collapsing still works", () => {
  it("keeps the toggle", () => {
    expect(SIDEBAR).toMatch(/<SidebarToggle \/>/);
  });

  it("the collapsed rail allows for the floating padding", () => {
    // 64px of rail plus 10px either side; the old 4rem would have squeezed the
    // pill once the aside gained padding.
    expect(CSS).toMatch(/html\.sidebar-collapsed \.app-sidebar \{[\s\S]*?width: 5\.25rem/);
  });

  it("swaps the wordmark for the monogram", () => {
    expect(CSS).toMatch(/html\.sidebar-collapsed \.app-sidebar \.logo-mark/);
  });

  it("shows the monogram larger than the original 2.5rem", () => {
    // 2.5rem read as an afterthought in the rail.
    expect(CSS).toMatch(/height: 3\.25rem/);
  });

  it("centres the monogram rather than left-aligning it", () => {
    // Padding alone cannot centre a 52px mark inside a 64px pill.
    expect(CSS).toMatch(/justify-content: center;/);
    // A true square tightened around the mark, not a panel filling the rail.
    expect(CSS).toMatch(/height: 4rem;\n  width: 4rem/);
  });
});

describe("the announcement bar matches", () => {
  it("is a pill, not a soft rectangle", () => {
    const block = CSS.slice(CSS.indexOf(".announce {"));
    expect(block.slice(0, 400)).toMatch(/border-radius: 9999px/);
  });

  it("still takes its colour from the theme", () => {
    expect(CSS).toMatch(/background: hsl\(var\(--announce, 17 100% 56%\)\)/);
  });
});


describe("the rest of the shell matches the rail", () => {
  it("the top bar is a pill too, not a slab with a hard edge", () => {
    // A square top bar next to a rounded rail was the remaining flat edge.
    expect(LAYOUT).toMatch(/rounded-full[\s\S]*?bg-card/);
    expect(LAYOUT).not.toMatch(/<header className="flex h-14 items-center gap-2 border-b/);
  });

  it("the toggle sits on the menu bar's edge", () => {
    // The aside carries 10px of padding outside the pill, so anchoring to the
    // aside left the chip floating clear of the menu.
    expect(CSS).toMatch(/left: 14\.5rem;/);
    expect(CSS).toMatch(/left: 4\.75rem;/);
  });

  it("is 18px — between the 26px that was too big and the 13px that was too small", () => {
    const TOG = readFileSync(join(process.cwd(), "src/components/shared/sidebar-toggle.tsx"), "utf8");
    expect(TOG).toMatch(/h-\[18px\] w-\[18px\]/);
    expect(TOG).toMatch(/<Icon className="h-\[12px\] w-\[12px\] scale-\[1\.5\]"/);
  });


  it("is a white circle with a grey outline", () => {
    const TOG = readFileSync(join(process.cwd(), "src/components/shared/sidebar-toggle.tsx"), "utf8");
    expect(TOG).toMatch(/border border-border bg-white/);
  });

  it("the arrow follows the Menu / navigation colour", () => {
    // The sidebar token, not a fixed burgundy — so changing the menu colour in
    // Appearance moves the arrow with it.
    const TOG = readFileSync(join(process.cwd(), "src/components/shared/sidebar-toggle.tsx"), "utf8");
    expect(TOG).toMatch(/text-\[color:hsl\(var\(--sidebar\)\)\]/);
    expect(TOG).not.toMatch(/#7B1E3A/);
  });

  it("the content sits closer to the rail", () => {
    // The rail already contributes its own 10px, so a full 24px on the content
    // left it 34px adrift.
    // pl-4 matches the header pill's mx-4, so page content and the
    // announcement bar share a left edge.
    expect(LAYOUT).toMatch(/sm:py-6 sm:pl-4 sm:pr-6/);
    expect(LAYOUT).toMatch(/sm:mx-4/);
  });
});


describe("the announcement bar stays put while you scroll", () => {
  it("the shell is viewport height, so the page itself never scrolls", () => {
    expect(LAYOUT).toMatch(/flex h-screen flex-col/);
  });

  it("only the content scrolls", () => {
    expect(LAYOUT).toMatch(/<main className="min-h-0 flex-1 overflow-y-auto/);
  });

  it("the bar is a sibling of the scroller, not inside it", () => {
    // Structural rather than position:sticky — a floating pill with sticky lets
    // content show through the gap above it and around the rounded corners.
    const header = LAYOUT.slice(LAYOUT.indexOf("<header"), LAYOUT.indexOf("</header>"));
    expect(header).toMatch(/shrink-0/);
    expect(header).not.toMatch(/sticky/);
    expect(LAYOUT.indexOf("</header>")).toBeLessThan(LAYOUT.indexOf("<main"));
  });
});


describe("the collapsed rail", () => {
  it("gives the logo a rounded SQUARE, not a circle", () => {
    // Fully rounded on a near-square box reads as a circle, which fights the
    // rounded-rectangle language every card in the app uses.
    expect(CSS).toMatch(/html\.sidebar-collapsed \.app-sidebar \.sidebar-head \{[\s\S]*?border-radius: 1rem/);
  });

  it("shows the date and time when you hover the clock", () => {
    // Collapsed hides the labels, so a bare clock icon says nothing.
    expect(CLOCK).toMatch(/clock-pop/);
    expect(CSS).toMatch(/html\.sidebar-collapsed \.app-sidebar \.clock-row:hover \.clock-pop/);
  });

  it("reaches the popup by keyboard too", () => {
    expect(CSS).toMatch(/\.clock-row:focus-within \.clock-pop/);
  });

  it("lets the popup escape the rail's clipping", () => {
    // .app-sidebar clips horizontally so labels vanish cleanly during the
    // animation; that same clipping would cut the popup off at the edge.
    expect(CSS).toMatch(/html\.sidebar-collapsed \.app-sidebar \{\n  overflow-x: visible/);
  });
});
