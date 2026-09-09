---
title: Mission and vision
description: The purpose, direction, and open science commitments behind NEMAR.
---

## Mission

NEMAR's mission is to make human neuroelectromagnetic data findable, understandable, citable,
and reusable.

That means more than placing files in a bucket. A useful research resource also explains what the
files contain, preserves their context, supports quality checks, exposes stable machine-readable
interfaces, and gives researchers a precise way to cite the state they used.

## Vision

Our vision is a research environment where a scientist can move from a question to a trustworthy
dataset, a reproducible analysis, and a precise citation without rebuilding the infrastructure
around every study or downloading everything before learning whether it is relevant.

NEMAR is being developed as an open, community-facing resource with NIH/NIMH support. The work is
aligned with the goals of the NEMAR resource and its NIH award while remaining useful beyond a
single grant period: open standards, public documentation, FAIR data practices, reproducible
software, and reviewable changes are part of the infrastructure itself.

## What this means in practice

- **Open by default where appropriate.** Published data, metadata, interfaces, documentation, and
  software should be inspectable and reusable under their stated licenses.
- **Standards before convenience.** BIDS-shaped source data and explicit schemas make the archive
  legible to people and tools that NEMAR did not write.
- **Citable, not frozen.** A DOI identifies a dataset and its released versions; corrections and
  improvements remain possible through a visible version history.
- **Human review with computational help.** Automation and AI can help validate and describe data,
  but publication authority and consequential corrections remain reviewable human decisions.
- **Useful at different scales.** A browser should support a first look, a CLI should support a
  repeatable workflow, and future compute services should make it practical to work near large
  collections.
- **Friendly to research agents.** Stable URLs, JSON metadata, manifests, BIDS paths, Markdown,
  schema.org records, and documentation should let software discover the same resource a person
  can use.

## Why CLI-first and web-facing

NEMAR's API and CLI provide the durable foundation: commands can be scripted, reviewed, rerun, and
used on infrastructure without a graphical session. The website is a consumer-facing shell around
those contracts. It lowers the entry cost for discovery and common tasks without creating a second
catalog or a different definition of a dataset.

See the [ecosystem overview](/ecosystem/), [CLI versus web guide](/ecosystem/cli-vs-web/), and
[guide for agents and tools](/platform/for-agents/) for the concrete interfaces.
