import { Icon } from "./Icon";

type TerminalBroadcastBannerProps = {
  connectedSessionCount: number;
  onTurnOff: () => void;
};

export function TerminalBroadcastBanner({
  connectedSessionCount,
  onTurnOff,
}: TerminalBroadcastBannerProps) {
  return (
    <div className="bcast-banner">
      <Icon name="network" size={12} />
      Broadcasting — Enter sends this command to {connectedSessionCount} connected sessions
      <button type="button" onClick={onTurnOff}>turn off</button>
    </div>
  );
}
