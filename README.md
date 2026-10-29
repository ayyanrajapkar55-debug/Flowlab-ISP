# FlowLab — Network Capacity & Protocol Co-Design Studio

## Concept
An input-driven network capacity simulator. The user builds traffic demands, selects router behavior, configures bottleneck capacity/latency/buffer/loss, and compares application outcomes. No canned incident narratives.

## Run on Windows (VS Code terminal)
1. Extract ZIP and open `FlowLab` folder in VS Code.
2. Run: `py -m http.server 5500`
3. Open http://localhost:5500
Alternatively `python -m http.server 5500` or use VS Code Live Server.

## Experiments
1. Run default preset, save result.
2. Reduce uplink from 20 Mbps to 3 Mbps, run and save, compare loss and queue delay.
3. Restore 20 Mbps and set priority QoS, compare gaming latency against FIFO.
4. Add many Video calls, and reduce buffer to demonstrate saturation.
5. Switch file traffic from TCP-like AIMD to fixed-rate and inspect effect on congestion.

## Simulation assumptions
- Discrete simulation clock: 5 ms. Traffic generation probabilistic per tick using deterministic xorshift RNG.
- A single bottleneck egress link with bytes-per-ms service rate, one router queue with user-selected discipline: FIFO, strict priority, or RED-like probabilistic early drop.
- Each workload is a configurable independent packet source. Configured input rates are offered load, not guaranteed throughput.
- Packet serialization time, user-configurable baseline one-way latency, wireless loss and per-packet buffering statistics are modeled.
- TCP-like AIMD only applies to flow names containing `file` or `download`. Its rate factor decreases upon router drop and increases periodically; it is *not* an RFC-accurate TCP implementation or a realistic packet-level retransmission model. Packets lost by the simulation are not resent.
- Link service completion after the simulation horizon is not counted as delivery. This can lower observed delivery toward the end of a run.
- Timing and chart results are illustrative rather than calibrated with physical hardware; strict priority can starve low priority streams.

## Architecture
`index.html` UI layout → `app.js` input collection/rendering → `simulator.js` pure discrete-event model → charts and CSV outputs.

## Validation
The project is self-contained and requires no backend. Run different seeds and save comparisons. For very large workloads, packet limits prevent browser hangs.
