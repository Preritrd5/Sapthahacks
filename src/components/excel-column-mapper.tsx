import React, { useState, useMemo } from "react";
import {
  Check,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Columns,
  Sparkles,
  CheckCircle2,
  XCircle,
  Pencil,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PORTAL_FIELDS,
  PORTAL_FIELD_MAP,
  createDefaultColumnMapping,
  validateColumnMapping,
  isUnambiguousMapping,
  type ColumnMappingState,
  type PortalFieldId,
} from "@/lib/column-mapping";
import { Magnetic, ShimmerButton } from "@/components/ui/motion-primitives";

interface ExcelColumnMapperProps {
  detectedHeaders: string[];
  sampleRow?: Record<string, string> | undefined;
  mapping: ColumnMappingState;
  onMappingChange: (newMapping: ColumnMappingState) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ExcelColumnMapper({
  detectedHeaders,
  sampleRow,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
}: ExcelColumnMapperProps) {
  // Track headers that administrator is actively editing
  const [editingHeaders, setEditingHeaders] = useState<Set<string>>(new Set());

  const validation = useMemo(() => validateColumnMapping(mapping), [mapping]);

  // Map of targetField -> list of headers with conflicts
  const conflictHeaderSet = useMemo(() => {
    const set = new Set<string>();
    for (const conflict of validation.duplicateFieldMappings) {
      for (const h of conflict.headers) {
        set.add(h);
      }
    }
    return set;
  }, [validation.duplicateFieldMappings]);

  const toggleColumnSelection = (header: string) => {
    const current = mapping[header];
    if (!current) return;
    const nextSelected = !current.selected;
    onMappingChange({
      ...mapping,
      [header]: {
        ...current,
        selected: nextSelected,
      },
    });
  };

  const setTargetField = (header: string, targetField: PortalFieldId) => {
    const current = mapping[header];
    if (!current) return;
    onMappingChange({
      ...mapping,
      [header]: {
        ...current,
        targetField,
        selected: targetField !== "ignore",
      },
    });
  };

  const startEditing = (header: string) => {
    setEditingHeaders((prev) => new Set(prev).add(header));
  };

  const stopEditing = (header: string) => {
    setEditingHeaders((prev) => {
      const next = new Set(prev);
      next.delete(header);
      return next;
    });
  };

  const handleSelectAll = () => {
    const next: ColumnMappingState = {};
    for (const h of detectedHeaders) {
      const cur = mapping[h];
      next[h] = {
        targetField: cur?.targetField ?? "custom_metadata",
        selected: true,
      };
    }
    onMappingChange(next);
  };

  const handleClearAll = () => {
    const next: ColumnMappingState = {};
    for (const h of detectedHeaders) {
      const cur = mapping[h];
      next[h] = {
        targetField: cur?.targetField ?? "ignore",
        selected: false,
      };
    }
    onMappingChange(next);
  };

  const handleAutoMap = () => {
    setEditingHeaders(new Set());
    onMappingChange(createDefaultColumnMapping(detectedHeaders));
  };

  const coreFields = PORTAL_FIELDS.filter((f) => f.category === "core");
  const memberFields = PORTAL_FIELDS.filter((f) => f.category === "members");
  const linkFields = PORTAL_FIELDS.filter((f) => f.category === "links");
  const specialFields = PORTAL_FIELDS.filter((f) => f.category === "special");

  return (
    <div className="space-y-4">
      {/* Configuration Header Card */}
      <div className="glass p-5 rounded-2xl border border-border/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold">
                2
              </span>
              <h3 className="text-base font-bold text-foreground">
                Select &amp; Map Excel Columns
              </h3>
              <Badge variant="outline" className="font-mono text-xs ml-2">
                {validation.selectedColumnCount} of {detectedHeaders.length} Selected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Recognized columns are automatically mapped. Unrecognized columns allow manual selection.
              All four team members and custom metadata are supported.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs h-8"
            >
              Select All ({detectedHeaders.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs h-8 text-muted-foreground hover:text-foreground"
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMap}
              className="text-xs h-8 gap-1 text-primary border-primary/30 hover:bg-primary/10"
            >
              <Sparkles className="size-3" /> Auto-Map Defaults
            </Button>
          </div>
        </div>

        {/* Conflict Warning: Duplicate target mappings */}
        {validation.duplicateFieldMappings.length > 0 && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Duplicate Field Mappings Detected ({validation.duplicateFieldMappings.length})
              </div>
              <p className="text-[11px] leading-relaxed">
                Each portal field can only be mapped to one Excel column. Please resolve the following duplicates:
              </p>
              <div className="space-y-1 pt-1">
                {validation.duplicateFieldMappings.map((c) => (
                  <div key={c.targetField} className="text-[11px] font-mono">
                    • <strong>{c.fieldLabel}:</strong> mapped to columns{" "}
                    <span className="underline">{c.headers.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Validation Status Notice: Missing mandatory fields */}
        {validation.missingRequiredFields.length > 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">
                Missing Required Portal Field Mappings ({validation.missingRequiredFields.length})
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                The following mandatory fields must be mapped to a selected Excel column before proceeding:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {validation.missingRequiredFields.map((f) => (
                  <Badge
                    key={f.id}
                    variant="destructive"
                    className="text-[10px] px-2 py-0.5 font-semibold"
                  >
                    {f.label} *
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : validation.duplicateFieldMappings.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <span className="font-medium">
                All columns mapped cleanly. Ready to preview and validate submissions.
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              Ready to Preview &rarr;
            </span>
          </div>
        ) : null}
      </div>

      {/* Column Mapping Table */}
      <div className="glass overflow-x-auto rounded-2xl border border-border/80">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40 border-b border-border">
            <tr>
              <th className="p-3 pl-4 w-12 text-center">Include</th>
              <th className="p-3">Detected Excel Column</th>
              <th className="p-3 max-w-xs">Sample Value (Row 1)</th>
              <th className="p-3 w-80">Target Platform Field</th>
              <th className="p-3 pr-4 text-center w-36">Field Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {detectedHeaders.map((header) => {
              const item = mapping[header] ?? { targetField: "ignore", selected: false };
              const targetDef = PORTAL_FIELD_MAP.get(item.targetField);
              const sampleVal = sampleRow ? sampleRow[header] : undefined;
              const isRequiredField = targetDef?.required ?? false;

              // Column is recognized unambiguously if matched to a known portal field
              const isRecognized =
                item.targetField !== "custom_metadata" &&
                item.targetField !== "ignore" &&
                isUnambiguousMapping(header, item.targetField);

              const hasConflict = conflictHeaderSet.has(header);
              const isEditing = editingHeaders.has(header) || hasConflict || (!isRecognized && item.selected);

              return (
                <tr
                  key={header}
                  className={`hover:bg-muted/30 transition-colors ${
                    hasConflict
                      ? "bg-rose-500/10"
                      : item.selected
                      ? "bg-primary/[0.02]"
                      : "opacity-60 bg-muted/10"
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="p-3 pl-4 text-center align-middle">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => toggleColumnSelection(header)}
                      aria-label={`Include column ${header}`}
                    />
                  </td>

                  {/* Excel Column Header */}
                  <td className="p-3 align-middle font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate" title={header}>
                        {header}
                      </span>
                      {hasConflict && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">
                          Conflict
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Sample Value */}
                  <td
                    className="p-3 align-middle text-xs font-mono text-muted-foreground max-w-xs truncate"
                    title={sampleVal || "—"}
                  >
                    {sampleVal ? (
                      sampleVal
                    ) : (
                      <span className="italic opacity-60">empty in row 1</span>
                    )}
                  </td>

                  {/* Target Platform Field: Simple Label if Recognized, Dropdown if Editing/Unknown */}
                  <td className="p-3 align-middle">
                    {!isEditing && targetDef && item.selected ? (
                      // Clean field label for unambiguous recognized mappings
                      <div className="flex items-center justify-between gap-2 bg-muted/20 px-2.5 py-1.5 rounded-lg border border-border/40">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                          <span className="font-semibold text-foreground text-xs truncate">
                            {targetDef.label}
                          </span>
                          {isRequiredField && (
                            <span className="text-amber-500 font-bold text-xs" title="Mandatory portal field">
                              *
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(header)}
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 gap-1 shrink-0"
                          title="Change mapping for this column"
                        >
                          <Pencil className="size-3" />
                          <span>Edit</span>
                        </Button>
                      </div>
                    ) : (
                      // Interactive Select Dropdown when editing or unrecognized
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={item.targetField}
                          onValueChange={(val: PortalFieldId) => setTargetField(header, val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/80">
                            <SelectValue placeholder="Map to field..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-80">
                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                Core Team Info
                              </SelectLabel>
                              {coreFields.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.label} {f.required && "*"}
                                </SelectItem>
                              ))}
                            </SelectGroup>

                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                Team Members (1–4)
                              </SelectLabel>
                              {memberFields.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.label} {f.required && "*"}
                                </SelectItem>
                              ))}
                            </SelectGroup>

                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                Links &amp; Artifacts
                              </SelectLabel>
                              {linkFields.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.label} {f.required && "*"}
                                </SelectItem>
                              ))}
                            </SelectGroup>

                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground">
                                Special Mappings
                              </SelectLabel>
                              {specialFields.map((f) => (
                                <SelectItem key={f.id} value={f.id} className="text-xs">
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>

                        {editingHeaders.has(header) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => stopEditing(header)}
                            className="h-8 px-2 text-xs text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 shrink-0"
                            title="Done editing mapping"
                          >
                            <Check className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="p-3 pr-4 text-center align-middle whitespace-nowrap">
                    {!item.selected || item.targetField === "ignore" ? (
                      <Badge variant="outline" className="text-[10px] opacity-70">
                        Ignored
                      </Badge>
                    ) : hasConflict ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Duplicate Mapping
                      </Badge>
                    ) : item.targetField === "custom_metadata" ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-sky-500/15 text-sky-600 border-sky-500/30"
                      >
                        Custom Metadata
                      </Badge>
                    ) : isRequiredField ? (
                      <Badge
                        variant="default"
                        className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/40"
                      >
                        Required *
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                      >
                        Mapped
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-sm">
        <div className="text-xs text-muted-foreground">
          {validation.selectedColumnCount} columns selected for processing. Unselected columns will be excluded from the database import.
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-9">
              Back / Cancel
            </Button>
          )}
          <Magnetic strength={4}>
            <ShimmerButton
              onClick={onConfirm}
              disabled={!validation.isValid}
              className="font-bold shadow-md gap-2 px-6 h-9 text-xs"
            >
              <span>Confirm Mapping &amp; Preview Data</span>
              <ArrowRight className="size-3.5" />
            </ShimmerButton>
          </Magnetic>
        </div>
      </div>
    </div>
  );
}
