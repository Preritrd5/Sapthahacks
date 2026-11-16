import { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePersistentTeam } from "@/lib/team-store";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DeleteTeamModalProps {
  team: { id: string; name: string; email?: string | null; project_title?: string | null; pdf_path?: string | null } | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteTeamModal({ team, isOpen, onClose, onDeleted }: DeleteTeamModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const qc = useQueryClient();

  if (!team) return null;

  const isConfirmed = confirmText.trim() === "delete";

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);

    try {
      // 1. Immediately remove from persistent local store
      deletePersistentTeam(team.id);

      // 2. Remove from Supabase if connected
      try {
        if (team.pdf_path) {
          await supabase.storage.from("project-pdfs").remove([team.pdf_path]);
        }
        await supabase.from("teams").delete().eq("id", team.id);
        await logActivity("Deleted team", team.name);
      } catch (cloudErr) {
        console.warn("Cloud deletion warning:", cloudErr);
      }

      // 3. Invalidate query cache across the entire application
      qc.invalidateQueries({ queryKey: ["team-rows"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["jobs-counts"] });

      toast.success(`Team "${team.name}" has been deleted.`);
      setConfirmText("");
      onClose();
      if (onDeleted) onDeleted();
    } catch (err) {
      toast.error(`Could not delete team: ${(err as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    if (isDeleting) return;
    setConfirmText("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md border-rose-500/30 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Will you confirm deleting this team?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                This action cannot be undone. All evaluation marks and reports will be removed.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Team details summary */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs space-y-1">
          <div className="font-semibold text-foreground text-sm">{team.name}</div>
          {team.email && <div className="text-muted-foreground">{team.email}</div>}
          {team.project_title && (
            <div className="text-muted-foreground truncate">{team.project_title}</div>
          )}
        </div>

        {/* Required Confirmation Input */}
        <div className="space-y-2 py-1">
          <Label htmlFor="delete-confirm-input" className="text-xs font-medium text-foreground">
            Please type <span className="font-mono font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">delete</span> in small letters to confirm:
          </Label>
          <Input
            id="delete-confirm-input"
            autoFocus
            autoComplete="off"
            placeholder='type "delete"'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="border-rose-500/30 focus-visible:ring-rose-500 text-sm font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConfirmed && !isDeleting) {
                handleDelete();
              }
            }}
          />
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleModalClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!isConfirmed || isDeleting}
            onClick={handleDelete}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 shadow-sm"
          >
            {isDeleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
