---
title: Compute roadmap
description: How NEMAR connects canonical data, chunked browser access, and a planned path to national HPC infrastructure.
---

## The simple idea

Large recordings are expensive to move. NEMAR therefore separates the authoritative source from
the access format used for interactive work:

1. The canonical source remains a versioned, BIDS-shaped dataset.
2. A conversion can create derived Zarr stores organized for chunked reads.
3. An edge Worker can serve only the metadata and chunks a browser asks for, with CORS and caching
   at the browser-facing boundary.
4. A viewer or analysis tool can inspect a small part of a recording before transferring the whole
   file.

![NEMAR edge and compute diagram showing canonical BIDS data, Zarr conversion, edge delivery, browser analysis, and a planned Tapis plus One Science Place HPC lane.](/figures/nemar-edge-compute.png)

**Figure 1.** The BIDS source remains authoritative. Zarr and edge delivery are derived access
layers; the HPC lane is a planned direction and is labeled that way in the figure.

## What is available now

`data.nemar.org` provides the public BIDS-shaped view, including metadata, manifests, and file
paths. Where a recording has a serving-copy conversion, `zarr.nemar.org` provides the browser
gateway for its derived Zarr store. The conversion can be incomplete for a particular recording;
that state should be visible rather than hidden behind a blank viewer. See [Zarr and edge access](/platform/zarr/)
for the access contract and [the operations runbook](/admin/operations/zarr-serving/) for
implementation detail.

## The SDSC and NSG bridge

NEMAR's compute direction is grounded in its partnership with the [San Diego Supercomputer Center
(SDSC)](https://www.sdsc.edu/news/2026/PR20260526-Neuro-AI.html). The [Neuroscience Gateway
(NSG)](https://www.nsgportal.org/) is an established resource for the neuroscience community: it
provides access to neuroscience tools and computing resources on HPC, HTC, and cloud infrastructure.
NEMAR contributes the structured, open, citable data layer; our aim is to connect a NEMAR
dataset, version, and workflow seamlessly to the appropriate compute resources so they can become
a reproducible analysis.

That partnership is what makes the data-to-compute loop practical. It is also why the planned
Tapis and One Science Place work matters: the goal is to connect NEMAR's dataset and citation
contracts to the national compute infrastructure that SDSC helps make usable, rather than sending
researchers back to rebuild transfers and environments by hand.

## The planned HPC direction

We envision using Tapis, through the One Science Place effort at the San Diego Supercomputer
Center, as an API layer for connecting NEMAR workflows to national HPC infrastructure. In plain
terms, a researcher or an agent would be able to describe a reproducible job, select an approved
compute resource, provide the dataset/version and inputs, and receive tracked outputs without
manually rebuilding the entire transfer and execution workflow.

This is a roadmap, not a promise that every NEMAR dataset can already launch a national HPC job.
The eventual design must still address authentication, allocation, data-use restrictions, software
environments, provenance, cost, and the location of sensitive inputs. Where policy and
infrastructure allow, the goal is to move only the data needed for a job or to schedule work close
to the data.

## What a useful result should contain

A compute result should be more than a file returned from a remote machine. The intended output
includes the input dataset and version, the code or container used, parameters, the execution
environment, logs or quality information, and a citable versioned derivative. That provenance is
what makes an analysis reproducible and lets another researcher understand what changed.

The longer-term goal is a continuum: inspect a signal in the browser, run a small analysis near
the edge, or submit a larger reproducible job to HPC using the same dataset and citation
contracts.
