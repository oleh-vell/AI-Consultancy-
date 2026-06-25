"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui";
import type { Account } from "@/lib/types";
import styles from "./Solution.module.css";

/* ---------------------------------------------------------------
   Solution tab — turns the discovery call into a build spec that
   drops straight into Claude Code. Everything below the heading is
   generated from the account: the bottleneck, the leverage, the
   timeline the client gave us on the call.
   --------------------------------------------------------------- */

function answer(account: Account, tag: string) {
  return account.answers.find((a) => a.tag === tag)?.a ?? "";
}

/** A short, slug-ish project name from the company. */
function projectSlug(company: string) {
  const base = company
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "client"}-agent`;
}

function buildSpec(account: Account): string {
  const bottleneck = answer(account, "bottleneck");
  const leverage = answer(account, "leverage");
  const timeline = answer(account, "timeline");
  const industry = account.industry.toLowerCase();
  const slug = projectSlug(account.company);

  return `# Build Spec — ${account.company} AI Engagement

> Generated autonomously from the discovery call with ${account.contact} (${account.role}).
> Hand this to Claude Code verbatim. Build on it — don't rewrite it.

## Your role
You are a senior software engineer with 10+ years shipping production
systems. You are precise, you read the existing code before you touch it,
and you make no mistakes. You think before you act. You never break a
working feature to ship a new one. When you are unsure, you ask — you do
not guess.

## The mission
Build a production-grade automation that removes ${account.company}'s single
biggest operational bottleneck. A ${account.employees}-person ${industry} team
in ${account.location} is losing time here every single day. Your job is to
give that time back.

## What we heard on the call
- **Company** — ${account.company} · ${account.industry} · ${account.employees} staff · ${account.location}
- **Stakeholder** — ${account.contact}, ${account.role}
- **The bottleneck, in their words**
  > "${bottleneck}"
- **Where the leverage is**
  > "${leverage}"
- **Timeline & budget**
  > "${timeline}"

## Goals
1. Automate the highest-frequency manual step named above end-to-end.
2. Keep a human in the loop: the agent drafts, ${account.contact.split(" ")[0]}'s
   team approves, the system learns from each correction.
3. Instrument everything — measure the time saved so the ROI is undeniable.
4. Ship something live and owned by the client, not a demo.

## Non-goals
- No open-ended scope creep. Solve the one bottleneck above first.
- No rip-and-replace of tools that already work for them.
- No black boxes — every automated decision must be explainable.

## Build plan — three milestones
**Week 1 · Discovery & mapping**
Shadow the real workflow. Quantify the cost of the bottleneck in hours and
pounds. Write it down before writing any code.

**Week 2 · Build**
Ship the agent that drafts the work. Wire approvals. Add the learning loop
so it improves from human corrections.

**Week 3 · Deploy & handover**
Go live in production. Train the team. Leave them in control with docs they
can actually read.

## Definition of done
- [ ] The named manual step runs automatically, with human approval gates.
- [ ] Time-saved is measured and visible on a simple dashboard.
- [ ] Tests cover the happy path and the obvious failure modes.
- [ ] A teammate who didn't build it can run, deploy, and extend it.
- [ ] Nothing that worked before is broken.

## Engineering constraints
- Read the surrounding code first. Match its conventions exactly.
- Small, reviewable commits. Each one leaves the app working.
- No secret keys in the repo. No console noise in production.
- Make no mistakes. If you catch yourself guessing, stop and verify.

---
*Suggested project name:* \`${slug}\`
*Source:* discovery call · ${account.callDuration} · ${account.company}
`;
}

export function Solution({ account }: { account: Account }) {
  const spec = useMemo(() => buildSpec(account), [account]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(spec);
      } else {
        const ta = document.createElement("textarea");
        ta.value = spec;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([spec], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectSlug(account.company)}-spec.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Ship it</span>
        <h1 className={styles.bigText}>Copy this into Claude Code</h1>
        <p className={styles.lede}>
          A refined build spec, generated from {account.contact}&apos;s discovery
          call. Paste it into Claude Code and let it build the engagement — the
          goals, scope, and constraints are already dialled in.
        </p>
        <div className={styles.actions}>
          <Button variant="primary" size="md" onClick={copy}>
            {copied ? "Copied to clipboard ✓" : "Copy spec"}
          </Button>
          <Button variant="ghost" size="md" onClick={download}>
            Download .md
          </Button>
        </div>
      </header>

      <div className={styles.file}>
        <div className={styles.fileBar}>
          <span className={styles.dots} aria-hidden="true">
            <i /> <i /> <i />
          </span>
          <span className={styles.fileName}>
            {projectSlug(account.company)}-spec.md
          </span>
          <button className={styles.copyMini} onClick={copy} type="button">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className={styles.code}>{spec}</pre>
      </div>
    </div>
  );
}
