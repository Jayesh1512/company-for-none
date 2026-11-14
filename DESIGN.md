---
name: Near Agent Workspace
description: A familiar workspace for managing agents and adding expertise.
colors:
  primary: "#c64b2c"
  primary-hover: "#aa3c22"
  page: "#fafafa"
  surface: "#ffffff"
  sidebar: "#f5f5f4"
  rail: "#202321"
  foreground: "#202522"
  muted: "#626a65"
  border: "#e4e7e4"
  focus: "#bf4b2c"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 550
rounded:
  control: "6px"
  card: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "35px"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
---

# Design System: Near Agent Workspace

## Overview

**Creative North Star: "A familiar agent workspace"**

The user requested Paperclip-like agent management. Persistent navigation, a real roster and direct create/configure/assign actions lead the interface. Compact familiar work-management conventions carry the visual authority; this is code-led rather than an exact reproduction of a supplied comp.

Key characteristics: quiet light working surfaces, a charcoal workspace rail, compact sans-serif type, restrained orange actions, small role-colored SVG avatars and real status vocabulary. The concept seed1bd01758 was acknowledged; the user-pinned reference governs the chosen direction.

## Colors

The primary burnt-orange accent marks consequential actions. Near-white surfaces and neutral borders keep the content dominant. Green/amber status indicators communicate state; sage/lavender/peach/blue avatar colors distinguish roles without implying real people.

**The Action Rule.** Reserve primary-color filled buttons for the current create, save, assign or approval action. Navigation selection uses neutral tonal contrast.

## Typography

One system sans stack serves the application. Headings25px/650, section titles14–16px, controls12px and secondary metadata10–11px. Dense metadata uses stronger contrast, not decorative typography. Prose stays within roughly65–75characters; task tables scroll within their container when the viewport is narrow.

## Layout

Desktop uses a48px workspace rail and218px sidebar with a flexible main surface. The top bar is63px high; main padding34px by38px. Agent cards use two flexible columns, three on very wide screens; marketplace cards use three columns with responsive reductions. Agent/listing detail pairs work with a properties/action panel.

At900px the rail disappears and detail/forms reduce columns. At700px the sidebar becomes a toggleable drawer, the top bar57px, main horizontal padding20px, forms/listings become single-column, and marketplace search occupies its own full-width row. The mobile discovery panel keeps its action below readable copy.

## Elevation & Depth

Borders and tonal surfaces define ordinary regions. A native help dialog alone uses soft neutral elevation, `0 18px 60px #00000026`, and a dim backdrop. Avatar tiles and ordinary cards carry no decorative glow.

## Shapes

Controls use6px corners and ordinary content cards12px corners. Avatars vary8–14px by size. Thin borders provide separation; there are no thick colored side stripes or custom decorative scroll treatments.

## Components

Primary/secondary buttons share shape and density. Inputs use a visible border, themed caret and a2px focus outline. Agent cards show role, persisted state, assigned skills, execution mode and actual task count. Marketplace cards preview category/type, outcome and price, opening a detailed listing before use.

The signature flow is template -> prefilled agent builder -> persisted agent workspace. Skills assign to an existing agent; services create its task. Draft/paused state prevents new task execution through Rules, and paused-agent controls visibly reflect that state. A report remains private behind its saved capability with a restore-key form when needed.

The mobile drawer and native help dialog support keyboard focus and Escape. Reduced motion removes transitions. There are no decorative page entrances.

## Do's and Don'ts

- Do make Agents, Marketplace and Create agent immediately findable.
- Do derive counts and statuses from persisted records.
- Do explain catalog authorship and demo execution where they affect a decision.
- Do keep source/report text inert and financial authority on the server.
- Don't invent expert endorsements, live provider connections or activity.
- Don't restore the report-order storefront as the application home.

## Company knowledge extension

Company knowledge uses the existing sidebar/list/detail pattern, typography and tokens. A compact connection row reports actual JBrain readiness; the library is a document table with access, version and update fields. The editor uses the existing form layout, native sharing radios and agent checkboxes. Task forms expose permitted document selections; task properties show exact revision references. Report publication is an explicit inline form with an access choice. Empty/unavailable states explain the next action. Desktop1440 and mobile390 actual create/edit/restrict/task/share flows were inspected; no horizontal overflow or browser exceptions. Existing palette advisories were recorded by the detector; this extension introduces no new literal colors.

## Organization setup workflow

The default entry is a six-stage organization setup. The desktop view pairs a connected horizontal ordered step rail with one active form/review pane and a factual organization summary. The active step uses the existing action color; completed reviews use the existing positive color and a check. On mobile the rail becomes two rows of three numbered stages, the summary recedes, and the existing drawer navigation remains available. Existing agent, profile, skill and company-knowledge editors return to their originating stage. Back/Continue controls stay with the current pane. Completion and readiness come from M01 and durable metadata, not browser progress flags. Runtime remains explicitly local fixture mode. Actual desktop1440/mobile390 flow, drawer navigation, six-stage completion and refresh were verified.

## Marketplace agent requirements

A compact agent selector and search lead into six requirement categories: Inference, Knowledge Base, Skills, Industry Leaders’ SOUL.md, External Services and Agentic Wallet Services. Desktop uses an internal category rail with factual agent context and flat listing rows; each row shows availability and opens a scoped detail. Templates remain a separate secondary category. Mobile presents every category in a visible two-column button grid. SOUL.md detail uses an escaped Markdown preview, source links, download and an explicit review-to-agent-settings flow. Connected, simulated and setup-required labels reflect actual local facts without implying funded live capabilities.

## Company activation and operation extension

The existing neutral workspace and orange actions remain. Company setup uses
clearer reviewed/current states and a white work pane. After the six steps, a
compact completion row leads into activation: operating terms sit beside the
service/agent/shared-knowledge form. Mobile stacks these in reading order.
Marketplace rows have stronger titles and more space; payment instructions wrap
long addresses. New headings use26–34px fluid page titles and22–24px operation
titles, with10–12px panel radii. These additions implement the requested visual
improvement without changing the product navigation or adding marketing claims.

Desktop1440/mobile390 browser checks cover activation, customer checkout,
private report, marketplace and settings; no horizontal overflow or page errors.
Demo and live states stay explicit. Owner limits display as USD amounts, while
server accounting retains integer nanoUSD. Provider proof, capital and credit
observations are not described as cryptographically verified.

## Company for none operations extension

The autonomous company uses the same Paperclip-inspired Operate workspace. Organization setup now has one flow. Company for none is the default for new companies. Its five visible steps are Define company, Review agents, Company brain, Boundaries & infra, and Review & finish. Saving the brief creates the real, paused manager/backlog profiles. Inline profile edits show their actual persisted names, role descriptions, instructions and written skills. Existing manual profiles remain available. Operations leads with the current objective and a factual work list beside a narrow manager/blocker panel. Work, Agents, Improvements, Purchases, Services & sales and Company ledger are direct tabs. Agent profile state is distinct from execution state; blocked work has a concrete reason and readiness link.

The team lane identifies the manager/backlog roles. Improvement detail shows before/candidate revisions and actual evaluation state. Resource installs, blocked purchases, service drafts and original orders remain separate. Company ledger is an authenticated causal timeline with wrapped IDs and exact per-asset amounts; public accounting remains separate. Context selection explains document grants versus a role's selected inputs.

Desktop1440/mobile390 browser checks use an isolated actual HTTP setup store, no financial/provider seed, and cover four-step creation, start intent, true blocked work, template/gap submission and refresh. A mobile ledger timestamp width defect was fixed. The bounded existing-critique screenshot review found the hierarchy consistent and requested no redesign. Source-scoped detector findings were zero. Functional wording corrections clarify template-only improvement and manager-specific proposals; no further visual polish loop is implied.


## Unified setup review —14 November2026

The active workspace no longer renders the mode-choice fork or a second autonomy wizard. Company operations is the execution section; Organization setup configures it. Core profiles appear before optional knowledge or infrastructure. A compact ordered rail and plain team rows reuse the existing Operate layout. Finish records current local configuration review and opens operations; execution remains a separate action. Existing explicit manual mode and all history are preserved.

Actual isolated HTTP/browser checks cover brief → editable team → optional brain → boundaries → finish, reload-persisted profile changes, organization/company alignment, old routes and cross-site denial. Desktop1440/mobile390 have no horizontal overflow or page exceptions. One bounded layout correction sizes skill checkboxes to17px. Native T3 navigation/semantic inspection worked; screenshot capture timed out and the host then explicitly became unavailable. Final screenshots use the documented repository browser workflow. No new design direction or raster asset was introduced.


Demo restoration —14 November2026: reuse the existing top-right secondary control and compact mobile header. Active state has an explicit fictional-sample notice. This iteration fills editable drafts only; it supersedes historical automatic seeding. Entered/saved company details remain, saving uses the real merged flow, and provider readiness is unchanged. One batched desktop1440/mobile390 visual review and native semantic interaction passed without layout corrections or a new design direction.


## Current E2E integration surface —14 November2026

Keep the same Operate workspace. Settings displays current M01 readiness (one row per capability), explicit refresh and human-readable lifetime USD ceiling. The real public attestation panel distinguishes gateway/model checks from unverified response/plaintext. Company improvements show escaped inert text proposals, explicit accept/reject owner review and a causal trace tied to original ledger sequence IDs; host proposals remain manual work. No paid-ready state is inferred from a codec or sample input. Existing desktop/mobile browser flows and native Settings interactions pass without a new visual direction.
