// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { Confetti } from "./Confetti";

afterEach(() => {
  vi.useRealTimers();
});

describe("Confetti", () => {
  it("renders a burst of particles", () => {
    render(<Confetti />);
    expect(screen.getByTestId("confetti")).toBeInTheDocument();
    expect(screen.getAllByTestId("confetti-particle").length).toBeGreaterThan(10);
  });

  it("removes itself after two seconds", () => {
    vi.useFakeTimers();
    render(<Confetti />);
    expect(screen.queryByTestId("confetti")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(screen.queryByTestId("confetti")).toBeNull();
  });

  it("honours prefers-reduced-motion by rendering nothing", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(<Confetti />);
    expect(screen.queryByTestId("confetti")).toBeNull();
    vi.unstubAllGlobals();
  });
});
