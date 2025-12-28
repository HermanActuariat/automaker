import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { syncSettingsToServer } from '@/hooks/use-settings-migration';

interface MCPPermissionSettingsProps {
  mcpAutoApproveTools: boolean;
  mcpUnrestrictedTools: boolean;
  onAutoApproveChange: (checked: boolean) => void;
  onUnrestrictedChange: (checked: boolean) => void;
}

export function MCPPermissionSettings({
  mcpAutoApproveTools,
  mcpUnrestrictedTools,
  onAutoApproveChange,
  onUnrestrictedChange,
}: MCPPermissionSettingsProps) {
  return (
    <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mcp-auto-approve" className="text-sm font-medium">
              Auto-approve MCP tools
            </Label>
            <p className="text-xs text-muted-foreground">
              Allow MCP tool calls without permission prompts (recommended)
            </p>
          </div>
          <Switch
            id="mcp-auto-approve"
            checked={mcpAutoApproveTools}
            onCheckedChange={async (checked) => {
              onAutoApproveChange(checked);
              await syncSettingsToServer();
            }}
            data-testid="mcp-auto-approve-toggle"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mcp-unrestricted" className="text-sm font-medium">
              Unrestricted tools
            </Label>
            <p className="text-xs text-muted-foreground">
              Allow all tools when MCP is enabled (don't filter to default set)
            </p>
          </div>
          <Switch
            id="mcp-unrestricted"
            checked={mcpUnrestrictedTools}
            onCheckedChange={async (checked) => {
              onUnrestrictedChange(checked);
              await syncSettingsToServer();
            }}
            data-testid="mcp-unrestricted-toggle"
          />
        </div>
      </div>
    </div>
  );
}
