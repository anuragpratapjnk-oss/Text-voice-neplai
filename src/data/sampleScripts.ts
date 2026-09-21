export interface SampleScriptPreset {
  id: string;
  fileName: string;
  title: string;
  category: string;
  fileType: string;
  content: string;
}

export const SAMPLE_SCRIPT_PRESETS: SampleScriptPreset[] = [
  {
    id: 'script-1',
    fileName: 'starship_aurora_scene4.fountain',
    title: 'Starship Aurora: Nebula Crossing',
    category: 'Film & Screenplay',
    fileType: 'fountain',
    content: `SCENE 4 - BRIDGE OF THE AURORA - NIGHT

COMMANDER VALERIE stands over the holographic star map. The deep hum of the ion engines reverberates through the deck.

COMMANDER VALERIE
(focused, urgent)
Ensign Puck, what's our sub-light velocity? We can't linger in this asteroid belt.

ENSIGN PUCK
(typing rapidly)
Holding at zero-point-four light speed, Commander. Sensors are picking up anomalous energy signatures near the pulsar.

COMMANDER VALERIE
Bring shields to maximum. Prepare to divert secondary power to thrusters.

ENSIGN PUCK
Shields at one hundred percent! Approaching the event boundary now.`,
  },
  {
    id: 'script-2',
    fileName: 'tech_horizons_podcast_ep42.txt',
    title: 'Tech Horizons Podcast: Voice Intelligence',
    category: 'Podcast & Interview',
    fileType: 'txt',
    content: `HOST ANURAG: Welcome back to Tech Horizons! Today we are exploring the revolutionary leap in conversational AI speech synthesis with Dr. Kore Lin.

DR. KORE: Thank you for having me, Anurag. The biggest breakthrough we are seeing is zero-latency natural inflection, subtle breath mechanics, and genuine multi-speaker acoustic pacing.

HOST ANURAG: It really feels like a paradigm shift. How does the model capture the nuances of spontaneous conversation without sounding robotic?

DR. KORE: It analyzes contextual rhythm and semantic emphasis simultaneously, generating authentic micropauses rather than static word concatenation.`,
  },
  {
    id: 'script-3',
    fileName: 'lumina_energy_commercial_30s.txt',
    title: 'Lumina Energy: 30-Second High Energy Spot',
    category: 'Commercial & Ad',
    fileType: 'txt',
    content: `VOICEOVER (PUCK):
Early morning alarm? Big project deadline? Don't just wake up—ignite your day.

(sound of can cracking open)

Introducing Lumina Spark. Zero sugar, pure botanical energy, and explosive citrus flavor.
Crush your goals. Elevate your focus.

Lumina Spark. Fuel the extraordinary. Available at retailers nationwide.`,
  },
  {
    id: 'script-4',
    fileName: 'ancient_redwoods_documentary.md',
    title: 'Ancient Redwoods: Giants of the Fog',
    category: 'Documentary',
    fileType: 'md',
    content: `NARRATOR (CHARON):
For over two thousand years, these ancient giants have stood silent vigil along the Pacific coast.

Reaching heights greater than thirty-story buildings, their crowns capture moisture directly from ocean fog, sustaining an intricate canopy ecosystem hundreds of feet above the forest floor.

In every ring of cedar and bark lies the chronicle of centuries—fires, droughts, and the slow, persistent resilience of nature.`,
  },
  {
    id: 'script-5',
    fileName: 'telehealth_consultation_dr_evans.txt',
    title: 'Telehealth Consultation: Dr. Evans & Sarah',
    category: 'Medical & Healthcare',
    fileType: 'txt',
    content: `DR. EVANS: Good afternoon Sarah. How have you been feeling since we adjusted your sleep schedule last week?

SARAH: Hi doctor! It has been much better. I am falling asleep around ten thirty and waking up feeling refreshed rather than groggy.

DR. EVANS: That is excellent progress. Let us continue with the 20-minute morning sunlight routine and check back in three weeks.`,
  },
  {
    id: 'script-6',
    fileName: 'eldoria_quest_dialogue.json',
    title: 'Eldoria Chronicles: The Sunken Relic',
    category: 'Gaming & Interactive',
    fileType: 'json',
    content: `{
  "scene": "Temple of the Sunken Relic",
  "characters": ["Fenrir the Guardian", "Aria the Explorer"],
  "dialogue": [
    {"speaker": "Aria", "line": "Look at the inscriptions on the archway. They glow with azure flame."},
    {"speaker": "Fenrir", "line": "Step carefully, traveler. The ancient wards have remained undisturbed for three thousand winters."},
    {"speaker": "Aria", "line": "I have the cipher key. Hold your torch high while I align the glyphs."}
  ]
}`,
  },
  {
    id: 'script-7',
    fileName: 'customer_support_aerofleet.txt',
    title: 'AeroFleet Airlines Support Call',
    category: 'Customer Support',
    fileType: 'txt',
    content: `AGENT KORE: Thank you for calling AeroFleet Priority Support. My name is Kore, how can I assist your travel today?

CUSTOMER MARK: Hi Kore, my connecting flight from Chicago was delayed, and I need to rebook on the next direct departure to Seattle.

AGENT KORE: I completely understand Mark, let me check the immediate options for you right now. I have confirmed your seat on Flight 418 departing at six forty-five PM.`,
  },
  {
    id: 'script-8',
    fileName: 'quantum_computing_lecture_101.txt',
    title: 'Quantum Computing: Qubits & Superposition',
    category: 'Education & Tech',
    fileType: 'txt',
    content: `PROFESSOR ZEPHYR:
Welcome students. Unlike classical bits which must exist strictly as a zero or a one, a quantum bit or qubit can exist in a superposition of both states simultaneously.

When we combine superposition with quantum entanglement, quantum processors can evaluate vast mathematical solution spaces exponentially faster than conventional supercomputers.`,
  },
  {
    id: 'script-9',
    fileName: 'detective_silent_clock_audiobook.txt',
    title: 'The Silent Clock: Mystery Audiobook Chapter 1',
    category: 'Audiobook & Fiction',
    fileType: 'txt',
    content: `NARRATOR (FENRIR):
The rain tapped rhythmically against the frosted glass of Baker & Cross Investigations. Inspector Miller adjusted his coat and stared at the grandfather clock in the corner of the study.

It was eleven past four, yet the heavy pendulum swung in utter silence.

"A clock that makes no sound in a room full of whispers," Miller murmured, jotting a fresh note in his leather journal.`,
  },
  {
    id: 'script-10',
    fileName: 'corporate_keynote_summit_2026.txt',
    title: 'Global Innovation Summit 2026 Opening Keynote',
    category: 'Business & Keynote',
    fileType: 'txt',
    content: `SPEAKER AOEDE:
Good morning leaders, innovators, and creators from around the world.

Today marks a defining milestone in human-computer collaboration. We are no longer merely instructing machines; we are conducting symphonies of ideas, voice, and intelligence in real time.

Let us explore what happens when imagination meets seamless execution.`,
  },
];
