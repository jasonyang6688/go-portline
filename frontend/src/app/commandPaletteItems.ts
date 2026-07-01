export type CommandPaletteItem = {
  label: string;
  sub: string;
  action: () => void;
};

type CommandPaletteConnection = {
  name: string;
  username: string;
  host: string;
  port: number;
};

type CommandPaletteSavedCommand = {
  name: string;
  command: string;
};

type CommandPaletteNavItem<TView extends string> = {
  id: TView;
  label: string;
};

export function createCommandPaletteItems<
  TConnection extends CommandPaletteConnection,
  TView extends string,
>({
  connections,
  navItems,
  savedCommands,
  onCreateConnection,
  onOpenConnection,
  onRunCommand,
  onSetView,
}: {
  connections: TConnection[];
  navItems: readonly CommandPaletteNavItem<TView>[];
  savedCommands: CommandPaletteSavedCommand[];
  onCreateConnection: () => void;
  onOpenConnection: (connection: TConnection) => void;
  onRunCommand: (command: string) => void;
  onSetView: (view: TView) => void;
}): CommandPaletteItem[] {
  return [
    {
      label: "New connection",
      sub: "Add an SSH host",
      action: onCreateConnection,
    },
    ...connections.map((connection) => ({
      label: `Connect ${connection.name}`,
      sub: `${connection.username}@${connection.host}:${connection.port}`,
      action: () => onOpenConnection(connection),
    })),
    ...savedCommands.map((command) => ({
      label: command.name,
      sub: command.command,
      action: () => onRunCommand(command.command),
    })),
    ...navItems.map((item) => ({
      label: item.label,
      sub: "Navigate",
      action: () => onSetView(item.id),
    })),
  ];
}

export function getFilteredCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    `${item.label} ${item.sub}`.toLowerCase().includes(normalizedQuery),
  );
}
