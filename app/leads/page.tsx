"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Avatar, StatusPill, Button, PageHeader } from "@/components/ui";
import { LiveCallModal } from "@/components/LiveCallModal";
import type { Lead } from "@/lib/types";
import styles from "./leads.module.css";

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 3.5 9 4l1 3.5L8 9a11 11 0 0 0 7 7l1.5-2 3.5 1 .5 2.5c0 .8-.7 1.5-1.5 1.5A15 15 0 0 1 5 5c0-.8.7-1.5 1.5-1.5Z" fill="currentColor" />
    </svg>
  );
}

export default function LeadsPage() {
  const leads = useStore((s) => s.leads);
  const previewLeads = useStore((s) => s.previewLeads);
  const addGeneratedLeads = useStore((s) => s.addGeneratedLeads);
  const deleteLead = useStore((s) => s.deleteLead);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [mandate, setMandate] = useState("");
  const [maxLeads, setMaxLeads] = useState("10");
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNote, setGenerateNote] = useState<string | null>(null);
  const [candidateLeads, setCandidateLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [queries, setQueries] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pending = leads.filter((l) => l.status === "queued" || l.status === "calling");
  const nextCall = pending[0]?.callAt;
  const selectedLeads = candidateLeads.filter((lead) => selectedIds.has(lead.id));

  const onGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = mandate.trim();
    if (!text || generating) return;

    setGenerating(true);
    setGenerateError(null);
    setGenerateNote(null);
    try {
      const limit = maxLeads.trim() ? Number(maxLeads) : undefined;
      const { leads, queries } = await previewLeads(text, limit);
      setCandidateLeads(leads);
      setSelectedIds(new Set(leads.map((lead) => lead.id)));
      setQueries(queries);
      setGenerateNote(
        leads.length
          ? `Found ${leads.length} candidate${leads.length === 1 ? "" : "s"}. Review and add the good ones.`
          : `No new phone-bearing leads found. Tried: ${queries.join(" · ")}`
      );
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Lead generation failed"
      );
    } finally {
      setGenerating(false);
    }
  };

  const onAddSelected = async () => {
    if (selectedLeads.length === 0 || adding) return;

    setAdding(true);
    setGenerateError(null);
    try {
      const { count } = await addGeneratedLeads(selectedLeads);
      setGenerateNote(`Added ${count} lead${count === 1 ? "" : "s"} to the queue.`);
      setCandidateLeads([]);
      setSelectedIds(new Set());
      setQueries([]);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not add leads");
    } finally {
      setAdding(false);
    }
  };

  const toggleLead = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === candidateLeads.length
        ? new Set()
        : new Set(candidateLeads.map((lead) => lead.id))
    );
  };

  const onDeleteLead = async (lead: Lead) => {
    if (deletingId || lead.status === "calling") return;

    setDeletingId(lead.id);
    setGenerateError(null);
    try {
      await deleteLead(lead.id);
      if (activeLead?.id === lead.id) setActiveLead(null);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not delete lead");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Leads"
        subtitle="The agency dials these prospects on schedule, unattended. Hit Call now to fast-forward the next one."
        actions={
          nextCall && (
            <div className={styles.nextChip}>
              <span className={styles.nextDot} />
              Next dial <strong className="tnum">{nextCall}</strong>
            </div>
          )
        }
      />

      <form className={styles.generator} onSubmit={onGenerate}>
        <div>
          <div className={styles.generatorFields}>
            <label className={styles.field}>
              <span className={styles.generatorLabel}>Lead mandate</span>
              <textarea
                className={styles.generatorInput}
                value={mandate}
                onChange={(event) => setMandate(event.target.value)}
                placeholder="e.g. independent dental practices in Manchester, or solar installers in Texas"
                rows={2}
              />
            </label>
            <label className={styles.maxField}>
              <span className={styles.generatorLabel}>Max new leads</span>
              <div className={styles.maxControl}>
                <input
                  className={styles.maxInput}
                  value={maxLeads}
                  onChange={(event) => setMaxLeads(event.target.value)}
                  inputMode="numeric"
                  min="1"
                  placeholder="All"
                  type="number"
                />
                <div className={styles.maxPresets} aria-label="Lead count presets">
                  {["10", "25"].map((value) => (
                    <button
                      className={maxLeads === value ? styles.maxPresetActive : styles.maxPreset}
                      key={value}
                      onClick={() => setMaxLeads(value)}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                  <button
                    className={maxLeads === "" ? styles.maxPresetActive : styles.maxPreset}
                    onClick={() => setMaxLeads("")}
                    type="button"
                  >
                    All
                  </button>
                </div>
              </div>
            </label>
          </div>
          {generateError ? (
            <p className={styles.generatorError}>{generateError}</p>
          ) : generateNote ? (
            <p className={styles.generatorNote}>{generateNote}</p>
          ) : (
            <p className={styles.generatorHint}>
              Uses Mistral for query ideas if configured, then SerpApi Google Maps
              to pull names, regions, and phone numbers.
            </p>
          )}
        </div>
        <Button
          variant="accent"
          type="submit"
          loading={generating}
          disabled={!mandate.trim()}
        >
          Generate leads
        </Button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thMain}>Prospect</th>
              <th>Industry</th>
              <th>Phone</th>
              <th className={styles.center}>Size</th>
              <th>Call at</th>
              <th>Status</th>
              <th className={styles.right}></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isDone = lead.status === "promoted";
              const isCalling = lead.status === "calling";
              return (
                <tr key={lead.id} className={isDone ? styles.dimmed : ""}>
                  <td className={styles.thMain}>
                    <div className={styles.prospect}>
                      <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={40} />
                      <div className={styles.prospectText}>
                        <span className={styles.company}>{lead.company}</span>
                        <LeadContact lead={lead} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.industry}>{lead.industry}</span>
                    <span className={styles.location}>{lead.location}</span>
                  </td>
                  <td className="tnum">
                    <span className={styles.phone}>{lead.phone}</span>
                  </td>
                  <td className={`${styles.center} tnum`}>{lead.employees}</td>
                  <td className="tnum">
                    <span className={styles.callAt}>{lead.callAt}</span>
                  </td>
                  <td>
                    <StatusPill status={lead.status} />
                  </td>
                  <td className={styles.right}>
                    <div className={styles.rowActions}>
                      {isDone ? (
                        <span className={styles.promotedNote}>In accounts ↗</span>
                      ) : (
                        <Button
                          variant={isCalling ? "secondary" : "primary"}
                          size="sm"
                          iconLeft={<PhoneIcon />}
                          onClick={() => setActiveLead(lead)}
                          disabled={isCalling}
                        >
                          {isCalling ? "On call…" : "Call now"}
                        </Button>
                      )}
                      <button
                        aria-label={`Delete ${lead.company}`}
                        className={styles.deleteLead}
                        disabled={deletingId === lead.id || isCalling}
                        onClick={() => onDeleteLead(lead)}
                        title="Delete lead"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeLead && (
        <LiveCallModal lead={activeLead} onClose={() => setActiveLead(null)} />
      )}

      {candidateLeads.length > 0 && (
        <TriageModal
          leads={candidateLeads}
          queries={queries}
          selectedIds={selectedIds}
          adding={adding}
          onToggle={toggleLead}
          onToggleAll={toggleAll}
          onClose={() => setCandidateLeads([])}
          onAdd={onAddSelected}
        />
      )}
    </div>
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function looksLikeUrl(value: string) {
  const text = value.trim().toLowerCase();
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.includes("?utm_") ||
    text.includes("/") ||
    /\.[a-z]{2,}(?:$|\/|\?)/.test(text)
  );
}

function contactText(lead: Lead) {
  const contact = lead.contact.trim();
  const role = lead.role.trim();
  if (isEmail(contact)) return contact;
  if (isEmail(role)) return role;

  const contactOk =
    contact && contact.toLowerCase() !== "main line" && !looksLikeUrl(contact);
  const roleOk = role && !looksLikeUrl(role) && role.toLowerCase() !== "business phone";

  if (contactOk && contact.split(/\s+/).length >= 2) {
    return [contact, roleOk ? role : ""].filter(Boolean).join(" · ");
  }
  return "";
}

function LeadContact({ lead }: { lead: Lead }) {
  const text = contactText(lead);
  return text ? <span className={styles.contact}>{text}</span> : null;
}

function TriageModal({
  leads,
  queries,
  selectedIds,
  adding,
  onToggle,
  onToggleAll,
  onClose,
  onAdd,
}: {
  leads: Lead[];
  queries: string[];
  selectedIds: Set<string>;
  adding: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const allSelected = selectedIds.size === leads.length;

  return (
    <div className={styles.modalBackdrop}>
      <section className={styles.triageModal} role="dialog" aria-modal="true">
        <header className={styles.triageHeader}>
          <div>
            <p className={styles.triageEyebrow}>Lead triage</p>
            <h2 className={styles.triageTitle}>
              {leads.length} candidate{leads.length === 1 ? "" : "s"} found
            </h2>
            <p className={styles.triageSub}>
              {queries.length ? `Queries: ${queries.join(" · ")}` : "Review before adding to the queue."}
            </p>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className={styles.triageToolbar}>
          <label className={styles.checkAll}>
            <input
              checked={allSelected}
              onChange={onToggleAll}
              type="checkbox"
            />
            Select all
          </label>
          <span className={styles.selectedCount}>
            {selectedIds.size} selected
          </span>
        </div>

        <div className={styles.triageList}>
          {leads.map((lead) => (
            <label className={styles.triageRow} key={lead.id}>
              <input
                checked={selectedIds.has(lead.id)}
                onChange={() => onToggle(lead.id)}
                type="checkbox"
              />
              <Avatar initials={lead.initials} hue={lead.hue} logo={lead.logo} size={34} />
              <span className={styles.triageCompany}>
                <strong>{lead.company}</strong>
                <span>{lead.industry}</span>
              </span>
              <span className={styles.triageMeta}>{lead.location}</span>
              <span className={`${styles.triagePhone} tnum`}>{lead.phone}</span>
              <span className={styles.triageContact}>{contactText(lead)}</span>
            </label>
          ))}
        </div>

        <footer className={styles.triageFooter}>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            loading={adding}
            disabled={selectedIds.size === 0}
            onClick={onAdd}
          >
            Add selected
          </Button>
        </footer>
      </section>
    </div>
  );
}
