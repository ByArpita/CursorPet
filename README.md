# Cursor Pet

A tiny digital companion that reacts to the way you move, wait, and work.

## Idea

Cursor Pet is a small interaction study about making an ordinary page feel a little more alive. There is no account, backend, or productivity dashboard—just a creature keeping you company.

## Interaction design

The pet follows at a gentle distance, watches the pointer, and changes pace with it. Give it time, click around, or start a focus session to see its quieter side. A few reactions are intentionally left for discovery.

## Technical approach

Pointer events update refs rather than React state on every move. A `requestAnimationFrame` loop measures velocity, eases the pet toward its target, and writes position through `translate3d`. `usePetBrain` coordinates the behavior model and emits semantic movement data; `DefaultPet` owns the SVG appearance, eye mapping, and character-specific animations. Reduced-motion preferences remove expressive movement while preserving the interactions. The focus timer uses an end-time calculation so it stays accurate when a browser tab is suspended.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Reusability

`CursorPet` is separated from the assignment page and accepts focused props for personality, sleep, stubbornness, and edge behavior. It can be embedded in another React or Next.js product without bringing along page-specific UI.

## Adding a character

Cursor Pet separates behavior from presentation. The pet brain emits semantic states such as idle, run, sleep, stubborn, and celebrate. Character components consume those states and decide how they should look, allowing the mascot to be replaced without rewriting interaction logic. Add a component under `components/cursor-pet/characters/`, implement the shared `PetCharacterProps` contract from `pet.types.ts`, then register its name in `characters/registry.ts`. The brain, pointer tracking, timer, and interaction logic stay unchanged.
