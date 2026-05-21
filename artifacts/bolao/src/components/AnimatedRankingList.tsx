import { useRef, useLayoutEffect, useState, useEffect } from "react";
import { Trophy, Medal, Target, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveRankingEntry } from "@workspace/api-client-react";

interface Props {
  entries: LiveRankingEntry[];
  currentUserId?: number;
  isLive: boolean;
  liveScore?: { home: number | null; away: number | null; homeTeam: string; awayTeam: string };
}

const ROW_HEIGHT = 72;

function PodiumBadge({ position }: { position: number }) {
  if (position === 1)
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
        <Trophy className="w-4 h-4 text-yellow-400" />
      </div>
    );
  if (position === 2)
    return (
      <div className="w-8 h-8 rounded-full bg-gray-400/20 border border-gray-400/30 flex items-center justify-center flex-shrink-0">
        <Medal className="w-4 h-4 text-gray-300" />
      </div>
    );
  if (position === 3)
    return (
      <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
        <Medal className="w-4 h-4 text-orange-400" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-muted-foreground">{position}</span>
    </div>
  );
}

function ProximityBar({ proximity, hasPrediction }: { proximity: number | null; hasPrediction: boolean }) {
  if (!hasPrediction)
    return <span className="text-xs text-muted-foreground/50 italic">sem palpite</span>;
  if (proximity === null)
    return null;

  const isExact = proximity === 0;
  const isClose = proximity <= 1;
  const isFar = proximity >= 4;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-700",
              i < (5 - Math.min(proximity, 5))
                ? isExact
                  ? "bg-yellow-400"
                  : isClose
                  ? "bg-primary"
                  : isFar
                  ? "bg-red-500/60"
                  : "bg-primary/70"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          isExact ? "text-yellow-400" : isClose ? "text-primary" : isFar ? "text-red-400" : "text-muted-foreground"
        )}
      >
        {isExact ? "exato!" : `${proximity} gol${proximity !== 1 ? "s" : ""} de distância`}
      </span>
    </div>
  );
}

function MovementIndicator({ delta }: { delta: number }) {
  if (delta === 0)
    return <Minus className="w-3.5 h-3.5 text-muted-foreground/50" />;
  if (delta > 0)
    return (
      <div className="flex items-center gap-0.5 text-emerald-400">
        <TrendingUp className="w-3.5 h-3.5" />
        <span className="text-xs font-bold">+{delta}</span>
      </div>
    );
  return (
    <div className="flex items-center gap-0.5 text-red-400">
      <TrendingDown className="w-3.5 h-3.5" />
      <span className="text-xs font-bold">{delta}</span>
    </div>
  );
}

export function AnimatedRankingList({ entries, currentUserId, isLive, liveScore }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Map userId → DOM node
  const nodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Store previous Y positions before re-render
  const prevPositions = useRef<Map<number, number>>(new Map());
  // Track previous rank for movement indicator
  const prevRankRef = useRef<Map<number, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Map<number, number>>(new Map());

  // Before React re-renders, record all current positions
  const recordPositions = () => {
    prevPositions.current.clear();
    nodeRefs.current.forEach((node, userId) => {
      if (node) {
        prevPositions.current.set(userId, node.getBoundingClientRect().top);
      }
    });
  };

  // After new render, FLIP animate each item from old pos → new pos
  useLayoutEffect(() => {
    const newDeltas = new Map<number, number>();

    nodeRefs.current.forEach((node, userId) => {
      if (!node) return;
      const oldTop = prevPositions.current.get(userId);
      if (oldTop === undefined) return;
      const newTop = node.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;

      if (Math.abs(deltaY) > 2) {
        // Apply inverse transform (jump to old position instantly)
        node.style.transition = "none";
        node.style.transform = `translateY(${deltaY}px)`;

        // Force reflow
        node.getBoundingClientRect();

        // Animate to natural position
        node.style.transition = "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)";
        node.style.transform = "translateY(0)";
      }
    });

    // Compute rank deltas
    entries.forEach((entry, idx) => {
      const prevRank = prevRankRef.current.get(entry.userId);
      if (prevRank !== undefined) {
        newDeltas.set(entry.userId, prevRank - (idx + 1));
      }
      prevRankRef.current.set(entry.userId, idx + 1);
    });

    setRankDeltas(newDeltas);
  }, [entries]);

  // Record positions synchronously before state update propagates
  useEffect(() => {
    recordPositions();
  });

  return (
    <div ref={containerRef} className="relative">
      {entries.map((entry, idx) => {
        const position = idx + 1;
        const isMe = entry.userId === currentUserId;
        const delta = rankDeltas.get(entry.userId) ?? 0;

        return (
          <div
            key={entry.userId}
            ref={(el) => {
              if (el) nodeRefs.current.set(entry.userId, el);
              else nodeRefs.current.delete(entry.userId);
            }}
            data-testid={`ranking-row-${entry.userId}`}
            className={cn(
              "flex items-center gap-4 px-5 border-b border-border last:border-0",
              "will-change-transform",
              isMe && "bg-primary/5 border-l-2 border-l-primary",
              position <= 3 && !isMe && "bg-muted/10"
            )}
            style={{ height: ROW_HEIGHT }}
          >
            {/* Position badge */}
            <PodiumBadge position={position} />

            {/* Name & details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "font-semibold text-sm truncate",
                    isMe ? "text-primary" : "text-foreground"
                  )}
                >
                  {entry.name}
                  {isMe && <span className="text-xs ml-1.5 text-primary/70">(você)</span>}
                </p>
                {isLive && <MovementIndicator delta={delta} />}
              </div>

              {isLive ? (
                <div className="mt-0.5">
                  {entry.hasPrediction && entry.predHome !== null && entry.predAway !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Palpite:{" "}
                        <span className="font-bold text-foreground tabular-nums">
                          {entry.predHome} x {entry.predAway}
                        </span>
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <ProximityBar proximity={entry.proximity ?? null} hasPrediction={entry.hasPrediction} />
                    </div>
                  ) : (
                    <ProximityBar proximity={null} hasPrediction={false} />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {entry.hasPrediction ? "tem palpite" : "sem palpite"}
                  </span>
                </div>
              )}
            </div>

            {/* Points */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-end gap-1 justify-end">
                <p
                  className={cn(
                    "text-xl font-black tabular-nums transition-all duration-500",
                    position === 1
                      ? "text-yellow-400"
                      : position === 2
                      ? "text-gray-300"
                      : position === 3
                      ? "text-orange-400"
                      : "text-foreground"
                  )}
                >
                  {entry.projectedTotal}
                </p>
                {isLive && entry.liveBonus > 0 && (
                  <span className="text-xs font-bold text-emerald-400 mb-0.5">
                    +{entry.liveBonus}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
