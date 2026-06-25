"use client";

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
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const pending = leads.filter((l) => l.status === "queued" || l.status === "calling");
  const nextCall = pending[0]?.callAt;

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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thMain}>Prospect</th>
              <th>Industry</th>
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
                        <span className={styles.contact}>
                          {lead.contact} · {lead.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.industry}>{lead.industry}</span>
                    <span className={styles.location}>{lead.location}</span>
                  </td>
                  <td className="tnum">
                    <span className={styles.callAt}>{lead.callAt}</span>
                  </td>
                  <td>
                    <StatusPill status={lead.status} />
                  </td>
                  <td className={styles.right}>
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
    </div>
  );
}
