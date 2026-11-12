import type { RecordedMission, RecordedProfile } from "../recorded/types";

// Seed records for the local database: one mission and the three existing crew profiles (Chen, Okafor, Alvarez).
// Profiles only. Measurement histories start EMPTY; the simulated sessions live in lib/demo and are never copied here.

export const SEED_MISSION: RecordedMission = { id: "mission-artemis-ii", name: "Artemis-II", startDate: "2026-09-30", totalDays: 120, currentDay: 42 };

export const SEED_ASTRONAUTS: RecordedProfile[] = [
  { id: "astro-chen", missionId: "mission-artemis-ii", fullName: "Dr. Mei Chen", displayName: "Dr. Chen", crewCode: "A-007", status: "Active", role: "Mission Specialist", ageYears: 41, heightCm: 168, massKg: 62, rehabFocus: "Left knee, post-ACL reconstruction", affectedLimb: "left", initials: "MC" },
  { id: "astro-okafor", missionId: "mission-artemis-ii", fullName: "Cmdr. Tunde Okafor", displayName: "Cmdr. Okafor", crewCode: "A-001", status: "Active", role: "Mission Commander", ageYears: 47, heightCm: 183, massKg: 84, rehabFocus: "Right knee, meniscus repair", affectedLimb: "right", initials: "TO" },
  { id: "astro-alvarez", missionId: "mission-artemis-ii", fullName: "Maj. Sofia Alvarez", displayName: "Maj. Alvarez", crewCode: "A-012", status: "Active", role: "Flight Engineer", ageYears: 36, heightCm: 172, massKg: 66, rehabFocus: "Right ankle, lateral ligament sprain", affectedLimb: "right", initials: "SA" },
];
