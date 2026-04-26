import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalBadge } from "@/components/arbitrage/SignalBadge";

describe("SignalBadge", () => {
  it("renders premium signal with red styling", () => {
    render(<SignalBadge type="PREMIUM" zScore={2.5} />);
    const badge = screen.getByText("溢价");
    expect(badge).toBeInTheDocument();
    expect(screen.getByText("Z:2.5")).toBeInTheDocument();
  });

  it("renders discount signal with green styling", () => {
    render(<SignalBadge type="DISCOUNT" zScore={-2.5} />);
    expect(screen.getByText("折价")).toBeInTheDocument();
  });

  it("renders pair signal", () => {
    render(<SignalBadge type="PAIR" />);
    expect(screen.getByText("配对")).toBeInTheDocument();
  });
});
