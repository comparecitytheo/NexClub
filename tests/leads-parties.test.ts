import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * The board has TWO renderers — cards and the list — and both name a party.
 *
 * The Sent tab was fixed on the card first and the list was missed, so the grid
 * showed "Sent to <recipient>" while the list beside it still said
 * "From <yourself>". Anything asserting one renderer would have passed. These
 * pin the rule in both, and that a single value drives them.
 */
const BOARD = "src/components/leads/lead-board.tsx";
const CARD = "src/components/leads/lead-card.tsx";
const LIST = "src/components/leads/lead-list.tsx";

describe("Received names the sender, Sent names the recipient, All names both", () => {
  const board = read(BOARD);
  const card = read(CARD);
  const list = read(LIST);

  it("the board derives one value for the tab and feeds both renderers", () => {
    expect(board).toMatch(/view === "all" \? "both" : view === "sent" \? "to" : "from"/);
    // Same value to the cards and to the list, so they cannot disagree.
    expect(board).toMatch(/<LeadCard[^>]*parties=\{cardParties\}/s);
    expect(board).toMatch(/<LeadList[\s\S]*?parties=\{cardParties\}/);
  });

  it("the card hides the side that is always you", () => {
    // Sent: the referrer is you, so that block is suppressed.
    expect(card).toMatch(/\{parties !== "to" && \(/);
    // Received: the recipient is you, so that block is suppressed.
    expect(card).toMatch(/\{parties !== "from" && \(/);
  });

  it("the list swaps the person column on Sent", () => {
    expect(list).toMatch(/personName: parties === "to" \? lead\.ownerName : lead\.referrerName/);
    expect(list).toMatch(/personLabel=\{parties === "to" \? "Sent to" : "From"\}/);
  });

  it("neither renderer hardcodes the sender", () => {
    // The regression was a fixed `personName: lead.referrerName` and a literal
    // personLabel="From", which are correct on Received and wrong on Sent.
    expect(list).not.toMatch(/personName: lead\.referrerName,/);
    expect(list).not.toMatch(/personLabel="From"/);
  });
});
