<script lang="ts">
  import { onMount } from "svelte";

  let {
    class: className = "w-24 h-24 text-foreground",
    activity = "auto",
    speed = 1.0,
    interactive = true,
    autoCycle = true,
    showDesk = true,
    onactivitychange,
  }: {
    class?: string;
    activity?: "auto" | "working" | "drinking" | "sleeping";
    speed?: number;
    interactive?: boolean;
    autoCycle?: boolean;
    showDesk?: boolean;
    onactivitychange?: (activity: "working" | "drinking" | "sleeping") => void;
  } = $props();

  let svg: SVGSVGElement;
  let bodyGroup: SVGGElement;
  let stemGroup: SVGGElement;
  let eyesGroup: SVGGElement;
  let leftEye: SVGPathElement;
  let rightEye: SVGPathElement;
  let leftBrow: SVGGElement;
  let laptopGroup: SVGGElement;
  let screenGlow: SVGRectElement;
  let cupGroup: SVGGElement;
  let steamPath1: SVGPathElement;
  let steamPath2: SVGPathElement;
  let zzzGroup: SVGGElement;

  const filterId = "bud_works_" + Math.random().toString(36).slice(2, 7);

  // Pristine Bud face vectors (same as BudDoesThings / BudReader)
  const NOSE_STEM_PATH =
    "M154.573 2C164.716 2.25175 172.946 6.6995 180.92 12.6555C183.102 14.2855 187.969 17.3385 188.265 20.299C188.334 20.997 188.148 21.637 187.692 22.1718C186.988 22.998 185.702 23.6418 184.612 23.2675C182.526 22.5518 180.597 20.491 178.829 19.198C172.375 14.4765 163.201 9.05075 154.954 9.686C150.546 10.0253 146.913 12.315 144.119 15.6573C126.677 36.5213 131.45 117.61 133.793 145.205L144.224 132.903C149.182 127.081 154.285 118.568 162.481 125.283C164.572 127.681 166.273 132.245 163.994 135.02C151.005 150.837 134.867 164.928 122.331 181.092C122.117 175.096 121.105 169.08 120.705 163.084C118.538 130.612 115.602 35.1083 137.279 10.6485C141.896 5.43851 147.62 2.38075 154.573 2Z";

  const LEFT_EYE_PATH =
    "M95.5129 66.4331C104.451 65.8273 106.496 69.4208 111.284 76.2528C116.699 82.5063 111.621 90.5116 107.237 81.2706C97.5494 60.8471 84.8746 84.5083 81.9534 95.8526C85.6414 90.8178 91.3236 85.9086 97.5069 91.2546C101.064 94.3301 101.307 99.8333 101.468 104.253C101.247 109.301 100.699 113.337 98.3891 118.038C96.3839 122.119 91.7436 126.619 87.3751 127.984C84.0891 129.016 80.5266 128.688 77.4841 127.074C63.6401 119.611 70.8529 94.6858 77.3034 84.2106C82.0294 76.5358 86.1959 69.0726 95.5129 66.4331Z";

  const RIGHT_EYE_PATH =
    "M167.025 44.4704C172.355 44.1429 175.969 46.6149 179.161 50.6439C181.069 53.0519 188.206 63.6356 180.965 63.4526C179.424 63.4139 176.871 57.9436 176.037 56.8029C173.966 53.7129 172.454 51.9826 168.556 51.0886C160.21 53.3166 154.759 66.2456 152.303 73.8451C154.795 70.8254 157.961 67.0404 162.19 67.1524C170.899 67.3834 171.782 76.9191 171.792 83.2724C171.551 88.8779 170.398 94.0674 167.162 98.7834C164.723 102.339 160.352 105.787 156.027 106.538C152.676 107.12 149.232 106.34 146.459 104.371C132.467 94.2824 143.909 65.2676 152.4 54.8404C156.484 49.8239 160.309 45.4891 167.025 44.4704Z";

  const LEFT_BROW_PATH =
    "M93.6561 22.4892C99.1249 21.7517 105.953 24.2347 110.326 27.3962C112.412 28.9042 116.383 32.2214 116.721 34.9364C117.313 39.6847 110.834 43.7487 107.124 40.0754C105.427 38.4307 103.996 36.3007 102.262 34.9142C99.5189 32.7524 96.0224 31.7834 92.5579 32.2252C83.2604 33.3494 75.0191 42.5322 69.6109 49.5404C65.6656 54.8812 62.9979 59.6997 60.0876 65.5967C59.4291 66.9309 58.9096 67.9312 57.5631 68.3199C57.0536 68.2497 56.6429 68.1509 56.2166 67.8459C55.7289 67.4967 55.4516 67.1182 55.3621 66.5182C54.9241 63.5837 63.3801 47.5589 65.1886 44.5614C66.9624 41.6139 68.9379 38.7924 71.1009 36.1174C77.0971 28.7369 83.8534 23.4872 93.6561 22.4892Z";

  // Exported control methods (mirrors BudDoesThings)
  export function startWorking() {
    setActivityState("working", true);
  }

  export function work() {
    setActivityState("working", true);
  }

  export function takeCoffeeBreak() {
    setActivityState("drinking", true);
  }

  export function takeNap() {
    setActivityState("sleeping", true);
  }

  export function wakeUp() {
    setActivityState("working", true);
  }

  export function getActivity() {
    return currentActivity;
  }

  let setActivityState: (act: "working" | "drinking" | "sleeping", force?: boolean) => void = () => {};
  let currentActivity = $state<"working" | "drinking" | "sleeping">("working");

  onMount(() => {
    let eyeX = -4.0, eyeY = 7.5;
    let stemX = 0, stemY = 2.4, stemRotate = 0.5;
    let browX = 0, browY = 4.0, browRotate = -0.4;
    let bodyX = 0, bodyY = 2.2, bodyRotate = 1.0;

    let cupCurrentX = 258, cupCurrentY = 240, cupCurrentRotate = 0;
    let targetCupX = 258, targetCupY = 240, targetCupRotate = 0;

    let targetEyeX = -4.0, targetEyeY = 7.5;
    let targetStemRotate = 0.5, targetStemX = 0.4, targetStemY = 2.4;
    let targetBrowRotate = -0.4, targetBrowX = 0.2, targetBrowY = 4.0;
    let targetBodyRotate = 1.0, targetBodyX = 0, targetBodyY = 2.2;

    let pointerTargetEyeX = 0, pointerTargetEyeY = 0;
    let pointerTargetStemX = 0, pointerTargetStemY = 0, pointerTargetStemRotate = 0;
    let pointerTargetBrowX = 0, pointerTargetBrowY = 0, pointerTargetBrowRotate = 0;
    let pointerTargetBodyX = 0, pointerTargetBodyY = 0, pointerTargetBodyRotate = 0;

    let lastPointerMoveTime = 0;
    let isPointerInWindow = true;
    let isPointerNear = false;
    let pointerCuriosityWeight = 0;

    // Typing cadence timers (keystroke bursts while facing the screen)
    const burstDuration = 1150;
    let accumulatedWorkTime = 0;
    let lastFrameTime = performance.now();

    // Activity state machine
    let stateStartTime = performance.now();
    let nextAutoSwitchTime = performance.now() + 8500 + Math.random() * 4000;
    let currentInternalActivity: "working" | "drinking" | "sleeping" = "working";

    const aromaCycleDuration = 4600; // ms (same as BudDoesThings)

    let sleepBreathTime = 0;

    let lastBurstIdx = 0;

    // Saccades
    let saccadeX = 0, saccadeY = 0;
    let targetSaccadeX = 0, targetSaccadeY = 0;
    let nextSaccadeTime = performance.now() + 300;

    // Blink state
    let blinkScale = 1;
    let isBlinking = false;
    let blinkStartTime = 0;
    let blinkDuration = 150;
    let isDoubleBlinking = false;
    let doubleBlinkStage = 0;
    let nextBlinkTime = performance.now() + 4500;

    let frame = 0;

    setActivityState = function (act: "working" | "drinking" | "sleeping", force = false) {
      if (currentInternalActivity === act && !force) return;
      currentInternalActivity = act;
      currentActivity = act;
      stateStartTime = performance.now();
      onactivitychange?.(act);

      if (act === "working") {
        accumulatedWorkTime = 0;
        triggerBlink(true);
      } else if (act === "sleeping") {
        triggerBlink();
      }
    };

    function triggerBlink(forceDouble = false) {
      if (isBlinking || currentInternalActivity === "sleeping") return;
      isBlinking = true;
      blinkStartTime = performance.now();
      blinkDuration = 150;
      isDoubleBlinking = forceDouble || Math.random() < 0.12;
      doubleBlinkStage = 0;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!interactive || !svg) return;
      lastPointerMoveTime = performance.now();
      isPointerInWindow = true;

      const rect = svg.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist < 130) {
        isPointerNear = true;
        // Nudging a napping Bud wakes it back to work
        if (currentInternalActivity === "sleeping" && activity === "auto" && dist < 65) {
          setActivityState("working");
          return;
        }

        const factor = Math.min(dist / 130, 1);
        const ease = Math.sin((factor * Math.PI) / 2);
        const nx = (dx / dist) * ease;
        const ny = (dy / dist) * ease;

        pointerTargetEyeX = nx * 14.0;
        pointerTargetEyeY = ny * 9.5;
        pointerTargetBodyX = nx * 2.8;
        pointerTargetBodyY = ny * 1.8;
        pointerTargetBodyRotate = nx * 2.8;
        pointerTargetStemRotate = nx * 3.8;
        pointerTargetStemX = nx * 2.2;
        pointerTargetStemY = ny * 3.2;
        pointerTargetBrowX = nx * 6.0;
        pointerTargetBrowY = ny * 5.0;
        pointerTargetBrowRotate = nx * 3.0 - ny * 2.0;
      } else {
        isPointerNear = false;
      }
    }

    function handlePointerLeave() {
      isPointerNear = false;
      isPointerInWindow = false;
    }

    function handlePointerEnter() {
      isPointerInWindow = true;
      lastPointerMoveTime = performance.now();
    }

    function animate(now: number) {
      const dt = Math.min(64, Math.max(1, now - lastFrameTime));
      lastFrameTime = now;
      const effectiveSpeed = Math.max(0.2, Math.min(3.5, speed));

      // Autonomous activity scheduler (mirrors BudDoesThings: work <-> coffee/nap)
      if (activity === "auto" && autoCycle) {
        if (now >= nextAutoSwitchTime) {
          if (currentInternalActivity === "working") {
            const pick = Math.random();
            if (pick < 0.6) {
              setActivityState("drinking");
              nextAutoSwitchTime = now + aromaCycleDuration + 400;
            } else {
              setActivityState("sleeping");
              nextAutoSwitchTime = now + 7500 + Math.random() * 4000;
            }
          } else {
            setActivityState("working");
            nextAutoSwitchTime = now + 9500 + Math.random() * 6000;
          }
        }
      } else if (activity !== "auto" && activity !== currentInternalActivity) {
        setActivityState(activity);
      }

      // ----------------------------------------------------
      // ACTIVITY 1: WORKING ON LAPTOP
      // Viewer sees the LID BACK; Bud sits behind it facing the screen.
      // Typing reads via gaze-down + keystroke bob + lid bounce + glow.
      // ----------------------------------------------------
      if (currentInternalActivity === "working") {
        accumulatedWorkTime += dt * effectiveSpeed;

        const burstTime = (accumulatedWorkTime % burstDuration) / burstDuration; // 0..1 within burst
        const burstIdx = Math.floor(accumulatedWorkTime / burstDuration);

        // Typing cadence tick (blink break, no laptop motion —
        // the laptop stays planted, Bud does the moving)
        if (burstIdx !== lastBurstIdx) {
          lastBurstIdx = burstIdx;
          if (Math.random() < 0.3) triggerBlink();
        }

        // Eyes look DOWN at the screen on Bud's side of the lid:
        // narrow focused sweeps (we never see the screen itself).
        const numKeys = 5;
        const keyStep = Math.floor(burstTime * numKeys);
        const keySub = (burstTime * numKeys) % 1;
        const snap = Math.min(1.0, Math.pow(keySub / 0.3, 2));
        const smoothProgress = (keyStep + snap) / numKeys;

        targetEyeX = -4.0 + smoothProgress * 8.0;
        targetEyeY = 8.2 + Math.sin(burstIdx * 1.7) * 0.9;

        // Focused typing posture: leaned slightly in, rapid micro-bob
        const typingBob = Math.sin(now * 0.022 * effectiveSpeed) * 0.9;
        const keyMash = Math.sin(now * 0.045 * effectiveSpeed) * 0.35;
        targetBodyX = 0;
        targetBodyY = 2.6 + typingBob * 0.6;
        targetBodyRotate = 1.2 + (smoothProgress - 0.5) * 1.0;
        targetStemX = targetEyeX * 0.1;
        targetStemY = 2.8 + keyMash * 0.4;
        targetStemRotate = (smoothProgress - 0.5) * 1.0;
        targetBrowX = targetEyeX * 0.12;
        targetBrowY = 4.1; // slight focus furrow
        targetBrowRotate = -0.6 + Math.sin(smoothProgress * Math.PI) * 0.4;

        targetCupX = 258;
        targetCupY = 240;
        targetCupRotate = 0;

        // Screen glow spilling over the lid's top edge pulses while typing
        if (screenGlow) {
          const pulse = 0.35 + 0.3 * Math.sin(now * 0.02 * effectiveSpeed) + 0.25 * burstTime;
          screenGlow.setAttribute("opacity", Math.min(0.85, Math.max(0.2, pulse)).toFixed(2));
        }

        if (zzzGroup) zzzGroup.style.display = "none";
      }

      // ----------------------------------------------------
      // ACTIVITY 2: COFFEE DRINKING RITUAL (same as BudDoesThings)
      // ----------------------------------------------------
      else if (currentInternalActivity === "drinking") {
        if (zzzGroup) zzzGroup.style.display = "none";

        const elapsedAroma = now - stateStartTime;
        const cycleDuration = aromaCycleDuration / effectiveSpeed;
        const progress = Math.min(1.0, Math.max(0, elapsedAroma / cycleDuration));

        if (progress < 0.15) {
          const p = progress / 0.15;
          const ease = 0.5 - 0.5 * Math.cos(p * Math.PI);
          targetEyeX = 12.0 * ease;
          targetEyeY = 7.5 * ease;
          targetBodyRotate = 1.5 * ease;
          targetStemRotate = 2.0 * ease;
          targetBrowRotate = -1.0 * ease;
          targetCupX = 258;
          targetCupY = 240 + Math.sin(p * Math.PI * 2) * 0.5;
          targetCupRotate = 0;
          blinkScale = 1.0;
        } else if (progress < 0.38) {
          const p = (progress - 0.15) / 0.23;
          const ease = 0.5 - 0.5 * Math.cos(p * Math.PI);
          targetCupX = 258 + (196 - 258) * ease;
          targetCupY = 240 + (136 - 240) * ease;
          targetCupRotate = -22.0 * ease;

          targetEyeX = 12.0 - p * 4.0;
          targetEyeY = 6.0;
          targetBodyX = 2.5 * ease;
          targetBodyRotate = 2.0 * ease;
          targetStemRotate = 2.4 * ease;
          targetBrowRotate = 1.2 * ease;
          blinkScale = 1.0;
        } else if (progress < 0.72) {
          const p = (progress - 0.38) / 0.34;
          const drinkTilt = Math.sin(p * Math.PI);
          const sipBob = Math.sin(p * Math.PI * 4);

          targetCupX = 196 - drinkTilt * 4.0;
          targetCupY = 136 + sipBob * 1.8;
          targetCupRotate = -22.0 - drinkTilt * 12.0;

          targetEyeX = 8.0;
          targetEyeY = 4.0;
          targetBodyX = 2.5 * (1 - drinkTilt * 0.5);
          targetBodyY = -2.2 * drinkTilt;
          targetBodyRotate = -1.8 * drinkTilt;
          targetStemRotate = -1.5 * drinkTilt;
          targetStemY = 2.0 + sipBob * 0.8;
          targetBrowRotate = 1.5 * drinkTilt;

          blinkScale = Math.max(0.06, 1.0 - drinkTilt * 0.94);
        } else if (progress < 0.92) {
          const p = (progress - 0.72) / 0.2;
          const ease = 0.5 - 0.5 * Math.cos(p * Math.PI);

          targetCupX = 196 + (258 - 196) * ease;
          targetCupY = 136 + (240 - 136) * ease;
          targetCupRotate = -22.0 * (1 - ease);

          targetEyeX = 8.0 * (1 - p);
          targetEyeY = 6.4;
          targetBodyX = 0;
          targetBodyY = 0;
          targetBodyRotate = 0;
          targetStemRotate = 0;
          targetBrowRotate = 0;
          blinkScale = 1.0;
        } else {
          const p = (progress - 0.92) / 0.08;
          const bounce = Math.sin(p * Math.PI) * 1.2;
          targetCupX = 258;
          targetCupY = 240 + bounce;
          targetCupRotate = 0;
          blinkScale = 1.0;
        }

        // Screen glow idles while sipping
        if (screenGlow) screenGlow.setAttribute("opacity", "0.25");

        if (progress >= 1.0) {
          if (activity === "auto") {
            setActivityState("working");
          } else if (activity === "drinking") {
            if (now - stateStartTime >= cycleDuration + 1500) {
              stateStartTime = now;
            }
          }
        }
      }

      // ----------------------------------------------------
      // ACTIVITY 3: SLEEPING / DOZING OFF (head onto laptop)
      // ----------------------------------------------------
      else if (currentInternalActivity === "sleeping") {
        targetCupX = 258;
        targetCupY = 240;
        targetCupRotate = 0;

        sleepBreathTime += dt * 0.001;
        const nod = Math.sin(sleepBreathTime * 1.5) * 1.8;

        targetEyeX = 0;
        targetEyeY = 9.0;
        targetBodyX = 0;
        targetBodyY = 5.2 + nod;
        targetBodyRotate = 1.8 + nod * 0.4;
        targetStemY = 4.0;
        targetStemRotate = 0.8;
        targetBrowY = 4.8;
        targetBrowRotate = -0.5;

        blinkScale = 0.05;

        // Screen goes dark while napping
        if (screenGlow) screenGlow.setAttribute("opacity", "0.12");

        if (zzzGroup) {
          zzzGroup.style.display = "block";
          const zCycle = (now * 0.0011) % 3.0;
          const zzzOpacity = Math.sin((zCycle / 3.0) * Math.PI);
          const zzzY = -zCycle * 15.0;
          zzzGroup.setAttribute(
            "transform",
            `translate(${142 + Math.sin(zCycle * 2.2) * 3} ${68 + zzzY})`,
          );
          zzzGroup.setAttribute("opacity", Math.max(0, zzzOpacity).toFixed(2));
        }
      }

      // Pointer curiosity
      const idleTime = now - lastPointerMoveTime;
      const shouldLookAtPointer =
        isPointerNear && idleTime < 1200 && currentInternalActivity !== "sleeping";

      if (shouldLookAtPointer) {
        pointerCuriosityWeight = Math.min(0.65, pointerCuriosityWeight + 0.08);
      } else {
        pointerCuriosityWeight = Math.max(0, pointerCuriosityWeight - 0.05);
      }

      // Micro-saccades
      if (now >= nextSaccadeTime) {
        targetSaccadeX = (Math.random() - 0.5) * 1.2;
        targetSaccadeY = (Math.random() - 0.5) * 0.8;
        nextSaccadeTime = now + 200 + Math.random() * 250;
      }
      saccadeX += (targetSaccadeX - saccadeX) * 0.28;
      saccadeY += (targetSaccadeY - saccadeY) * 0.28;

      // Breathing physics
      const breathFreq = currentInternalActivity === "sleeping" ? 0.0011 : 0.0017;
      const breathTime = now * breathFreq;
      const breathRaw = Math.sin(breathTime) + 0.24 * Math.sin(breathTime * 2.0 - 0.5);
      const breathY = breathRaw * (currentInternalActivity === "sleeping" ? -1.6 : -0.9);
      const breathStemY = breathRaw * -0.5;
      const breathBrowY = breathRaw * -0.4;
      const swayRot = Math.cos(breathTime * 0.5) * 0.4;

      // Blend targets
      const effTargetEyeX =
        pointerTargetEyeX * pointerCuriosityWeight + targetEyeX * (1 - pointerCuriosityWeight);
      const effTargetEyeY =
        pointerTargetEyeY * pointerCuriosityWeight + targetEyeY * (1 - pointerCuriosityWeight);

      const effTargetBodyX =
        pointerTargetBodyX * pointerCuriosityWeight + targetBodyX * (1 - pointerCuriosityWeight);
      const effTargetBodyY =
        pointerTargetBodyY * pointerCuriosityWeight + targetBodyY * (1 - pointerCuriosityWeight);
      const effTargetBodyRotate =
        pointerTargetBodyRotate * pointerCuriosityWeight +
        targetBodyRotate * (1 - pointerCuriosityWeight);

      const effTargetStemX =
        pointerTargetStemX * pointerCuriosityWeight + targetStemX * (1 - pointerCuriosityWeight);
      const effTargetStemY =
        pointerTargetStemY * pointerCuriosityWeight + targetStemY * (1 - pointerCuriosityWeight);
      const effTargetStemRotate =
        pointerTargetStemRotate * pointerCuriosityWeight +
        targetStemRotate * (1 - pointerCuriosityWeight);

      const effTargetBrowX =
        pointerTargetBrowX * pointerCuriosityWeight + targetBrowX * (1 - pointerCuriosityWeight);
      const effTargetBrowY =
        pointerTargetBrowY * pointerCuriosityWeight + targetBrowY * (1 - pointerCuriosityWeight);
      const effTargetBrowRotate =
        pointerTargetBrowRotate * pointerCuriosityWeight +
        targetBrowRotate * (1 - pointerCuriosityWeight);

      eyeX += (effTargetEyeX + saccadeX - eyeX) * 0.22;
      eyeY += (effTargetEyeY + saccadeY - eyeY) * 0.22;

      bodyX += (effTargetBodyX - bodyX) * 0.08;
      bodyY += (effTargetBodyY + breathY - bodyY) * 0.08;
      bodyRotate += (effTargetBodyRotate + swayRot - bodyRotate) * 0.08;

      stemX += (effTargetStemX - stemX) * 0.12;
      stemY += (effTargetStemY + breathStemY - stemY) * 0.12;
      stemRotate += (effTargetStemRotate + swayRot * 0.6 - stemRotate) * 0.11;

      browX += (effTargetBrowX - browX) * 0.14;
      browY += (effTargetBrowY + breathBrowY - browY) * 0.14;
      browRotate += (effTargetBrowRotate - browRotate) * 0.12;

      // Apply transforms
      if (bodyGroup) {
        bodyGroup.setAttribute(
          "transform",
          `translate(${bodyX.toFixed(2)} ${bodyY.toFixed(2)}) rotate(${bodyRotate.toFixed(2)} 127 110)`,
        );
      }

      if (stemGroup) {
        stemGroup.setAttribute(
          "transform",
          `translate(${stemX.toFixed(2)} ${stemY.toFixed(2)}) rotate(${stemRotate.toFixed(2)} 122 175)`,
        );
      }

      if (eyesGroup) {
        eyesGroup.setAttribute("transform", `translate(${eyeX.toFixed(2)} ${eyeY.toFixed(2)})`);
      }

      if (leftBrow) {
        leftBrow.setAttribute(
          "transform",
          `translate(${browX.toFixed(2)} ${browY.toFixed(2)}) rotate(${browRotate.toFixed(2)} 86 45)`,
        );
      }

      // Animate cup position and rotation
      cupCurrentX += (targetCupX - cupCurrentX) * 0.18;
      cupCurrentY += (targetCupY - cupCurrentY) * 0.18;
      cupCurrentRotate += (targetCupRotate - cupCurrentRotate) * 0.18;

      if (cupGroup) {
        cupGroup.setAttribute(
          "transform",
          `translate(${cupCurrentX.toFixed(2)} ${cupCurrentY.toFixed(2)}) rotate(${cupCurrentRotate.toFixed(2)} 14 12)`,
        );
      }

      // Steam animation
      if (steamPath1 && steamPath2) {
        const sTime = now * 0.0025;
        const leanDrift = currentInternalActivity === "drinking" ? -6.0 : 0;
        const w1 = Math.sin(sTime) * 3 + leanDrift;
        const w2 = Math.cos(sTime * 1.2) * 2.5 + leanDrift;

        steamPath1.setAttribute(
          "d",
          `M 8 -4 C ${5 + w1} -12 ${12 + w1} -20 ${8 + w1} -28 C ${4 + w1} -36 ${11 + w1} -44 7 -50`,
        );
        steamPath2.setAttribute(
          "d",
          `M 17 -6 C ${21 + w2} -14 ${14 + w2} -22 ${18 + w2} -30 C ${22 + w2} -38 ${15 + w2} -45 19 -52`,
        );
      }

      // Blinking engine
      if (currentInternalActivity !== "sleeping" && currentInternalActivity !== "drinking") {
        if (!isBlinking && now >= nextBlinkTime) {
          triggerBlink();
        }

        if (isBlinking && leftEye && rightEye) {
          const elapsed = now - blinkStartTime;
          if (elapsed >= blinkDuration) {
            if (isDoubleBlinking && doubleBlinkStage === 0) {
              doubleBlinkStage = 1;
              blinkStartTime = now;
              blinkDuration = 55;
              blinkScale = 0.85;
            } else if (isDoubleBlinking && doubleBlinkStage === 1) {
              doubleBlinkStage = 2;
              blinkStartTime = now;
              blinkDuration = 120;
            } else {
              isBlinking = false;
              isDoubleBlinking = false;
              doubleBlinkStage = 0;
              blinkScale = 1;
              nextBlinkTime = now + 4500 + Math.random() * 4500;
              leftEye.removeAttribute("transform");
              rightEye.removeAttribute("transform");
            }
          } else {
            const progress = elapsed / blinkDuration;
            const closeAmount = Math.sin(progress * Math.PI);
            blinkScale = Math.max(0.08, 1 - closeAmount * 0.92);

            leftEye.setAttribute(
              "transform",
              `translate(91 98) scale(1 ${blinkScale.toFixed(3)}) translate(-91 -98)`,
            );
            rightEye.setAttribute(
              "transform",
              `translate(161 76) scale(1 ${blinkScale.toFixed(3)}) translate(-161 -76)`,
            );
          }
        }
      } else if (leftEye && rightEye) {
        leftEye.setAttribute(
          "transform",
          `translate(91 98) scale(1 ${blinkScale.toFixed(3)}) translate(-91 -98)`,
        );
        rightEye.setAttribute(
          "transform",
          `translate(161 76) scale(1 ${blinkScale.toFixed(3)}) translate(-161 -76)`,
        );
      }

      frame = requestAnimationFrame(animate);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);
    document.addEventListener("mouseenter", handlePointerEnter);

    frame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      document.removeEventListener("mouseenter", handlePointerEnter);
      cancelAnimationFrame(frame);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<svg
  bind:this={svg}
  class="{className} select-none cursor-pointer overflow-visible"
  viewBox="-30 -16 335 320"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  overflow="visible"
  style="overflow: visible;"
  role="button"
  tabindex="0"
  aria-label="Bud works on a laptop facing away, sips coffee, and naps"
  onclick={(e) => {
    if (!interactive || !svg) return;
    if (currentActivity === "sleeping") {
      wakeUp();
      return;
    }

    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Coffee mug area (bottom right)
    if (clickX > rect.width * 0.72 && clickY > rect.height * 0.6) {
      takeCoffeeBreak();
      return;
    }

    // Clicking the laptop refocuses on work
    startWorking();
  }}
>
  <defs>
    <filter
      id={filterId}
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
      color-interpolation-filters="sRGB"
    >
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feBlend
        mode="normal"
        in="SourceGraphic"
        in2="BackgroundImageFix"
        result="shape"
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.2 0.2"
        numOctaves="3"
        seed="5016"
      />
      <feDisplacementMap
        in="shape"
        scale="4"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displacedImage"
      />
      <feMerge>
        <feMergeNode in="displacedImage" />
      </feMerge>
    </filter>
  </defs>

  <g filter={`url(#${filterId})`}>
    <!-- Desk Surface Line & Saucer -->
    {#if showDesk}
      <path
        d="M -15 265 L 292 265"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.32"
      />
      <ellipse
        cx="272"
        cy="264"
        rx="15"
        ry="3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        opacity="0.45"
      />
    {/if}

    <!-- Living Head & Face Group -->
    <g bind:this={bodyGroup}>
      <g bind:this={stemGroup}>
        <path d={NOSE_STEM_PATH} fill="currentColor" />
      </g>

      <g bind:this={eyesGroup}>
        <path bind:this={leftEye} d={LEFT_EYE_PATH} fill="currentColor" />
        <path bind:this={rightEye} d={RIGHT_EYE_PATH} fill="currentColor" />
      </g>

      <g bind:this={leftBrow}>
        <path d={LEFT_BROW_PATH} fill="currentColor" />
      </g>
    </g>

    <!-- Laptop, lid BACK facing the viewer (Bud sits on the far side).
         Same desk footprint as the book for clean crossfades.
         Viewer sees: lid back + the thin rear edge of the base.
         Base, keys, trackpad and lip all face Bud — hidden behind the lid. -->
    <g bind:this={laptopGroup}>
      <!-- Lid back (solid slab, same chalk weight as the book) -->
      <rect
        x="48"
        y="144"
        width="172"
        height="104"
        rx="10"
        fill="currentColor"
      />
      <!-- Lid logo -->
      <circle
        cx="134"
        cy="196"
        r="9"
        fill="none"
        stroke="black"
        stroke-width="1.6"
        opacity="0.35"
      />
      <!-- Screen glow spilling over the lid's top edge while typing -->
      <rect
        bind:this={screenGlow}
        x="58"
        y="139"
        width="152"
        height="5"
        rx="2.5"
        fill="currentColor"
        opacity="0.4"
      />
      <!-- Base rear edge, seen edge-on: slim modern bar on the desk.
           Same width as the lid, no chunky overhang.
           No flare toward the viewer — the base extends away, toward Bud. -->
      <rect
        x="46"
        y="250"
        width="176"
        height="11"
        rx="3"
        fill="currentColor"
      />
    </g>

    <!-- Coffee Mug (same as BudDoesThings) -->
    <g bind:this={cupGroup} transform="translate(258, 240)">
      <path d="M 2 2 C 2 -1 24 -1 24 2 L 21 22 C 20 25 5 25 4 22 Z" fill="currentColor" />
      <path
        d="M 23 5 C 31 5 32 17 21 19"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
      />

      <path
        bind:this={steamPath1}
        d="M 8 -4 C 5 -12 12 -20 8 -28 C 4 -36 11 -44 7 -50"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        opacity="0.75"
      />
      <path
        bind:this={steamPath2}
        d="M 17 -6 C 21 -14 14 -22 18 -30 C 22 -38 15 -45 19 -52"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        opacity="0.6"
      />
    </g>

    <!-- Floating Sleep Z's -->
    <g bind:this={zzzGroup} style="display: none;">
      <path
        d="M -5 -10 L 2 -10 L -5 -3 L 2 -3 M 5 -22 L 14 -22 L 5 -13 L 14 -13 M 16 -36 L 27 -36 L 16 -24 L 27 -24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
  </g>
</svg>
