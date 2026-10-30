# 33% peer-missile experiment — October 30

Headless comparison only. Normal game damage remains unchanged. See [method and conclusions](../../docs/PEER_DAMAGE_STUDY.md).

7,668 fight runs compare old damage and the candidate with the same smooth walking, bounded rotation and gradual suction. Another 405 cases test earning ammunition; 15 test immediate capture growth. Each fight starts with a guaranteed real hit and an unarmed defender.

| Equal-sized, no spare ammo | Damage | Defender KO | Defender captured | Both free/alive |
|---|---|---:|---:|---:|
| bot | Current | 24/45 | 2/45 | 19/45 |
| retreat | Current | 4/45 | 1/45 | 40/45 |
| bot | 33% candidate | 30/45 | 2/45 | 13/45 |
| retreat | 33% candidate | 7/45 | 1/45 | 37/45 |

| Reload against an equal rival | Ammo source | Damage | Defender KO | KO under 5s |
|---|---|---|---:|---:|
| bot fire / bot defense | active | Current | 52/405 | 11/405 |
| bot fire / bot defense | idle | Current | 98/405 | 26/405 |
| bot fire / retreat defense | active | Current | 9/405 | 3/405 |
| bot fire / retreat defense | idle | Current | 28/405 | 12/405 |
| prompt fire / retreat defense | active | Current | 35/405 | 13/405 |
| prompt fire / retreat defense | idle | Current | 149/405 | 89/405 |
| prompt fire / weave defense | active | Current | 35/405 | 6/405 |
| prompt fire / weave defense | idle | Current | 124/405 | 48/405 |
| bot fire / bot defense | active | 33% | 79/405 | 29/405 |
| bot fire / bot defense | idle | 33% | 162/405 | 74/405 |
| bot fire / retreat defense | active | 33% | 71/405 | 40/405 |
| bot fire / retreat defense | idle | 33% | 160/405 | 71/405 |
| prompt fire / retreat defense | active | 33% | 139/405 | 58/405 |
| prompt fire / retreat defense | idle | 33% | 336/405 | 181/405 |
| prompt fire / weave defense | active | 33% | 124/405 | 51/405 |
| prompt fire / weave defense | idle | 33% | 270/405 | 135/405 |

Idle prey are deliberately cheap-ammo controls and must not be pooled with active prey to claim earned-capture balance.

| Earned ammo, source initially active | Initial edge gap | Acquired within 20s | Median successful time | Acquired under 2s |
|---|---:|---:|---:|---:|
| tiny | 40 | 42/45 | 1.933s | 26/45 |
| tiny | 240 | 30/45 | 3.833s | 6/45 |
| tiny | 600 | 25/45 | 11s | 0/45 |
| half | 40 | 45/45 | 0.867s | 39/45 |
| half | 240 | 41/45 | 2.2s | 15/45 |
| half | 600 | 39/45 | 6.667s | 5/45 |
| largest | 40 | 41/45 | 2.333s | 18/45 |
| largest | 240 | 28/45 | 8.233s | 6/45 |
| largest | 600 | 21/45 | 10.767s | 2/45 |

Population totals: three staged twenty-bot runs of ten minutes per rule. Current results are the saved smooth-suction baseline.

| Rule | Captures | Shots | Hits | Hits on current leader | Runner-up hits on leader | Current-leader KOs |
|---|---:|---:|---:|---:|---:|---:|
| size-pull-after | 116 | 111 | 59 | 2 | 0 | 0 |
| peer-33 | 125 | 117 | 80 | 11 | 5 | 0 |

Leader means rank at that tick; a former leader may lose rank before a later knockout. This is not a count of all former-leader deaths.

Decision: do not enable the candidate yet. The stronger first hit is credible, but quick earned reloads compound injury shrink, immediate capture growth and the existing 20%-wider finish. Sideways movement improves survival without removing this failure mode.

Raw case summaries, source hashes, grouped size/distance results and the fast-reload example are in [peer-damage-summary.json](peer-damage-summary.json).
