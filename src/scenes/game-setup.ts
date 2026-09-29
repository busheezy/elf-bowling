import type { Scene } from "../scene";
import type { Sprite } from "../sprite";

const FLY_DY = [-30, -15, -9, -6, -4, -2, -1, 0, 1, 2, 4, 6, 9, 15];
const HOP_DY = [-16, -12, -8, -4, 0, 4, 8, 12];
const KALVIN_HOP_DY = [-10, -5, -2, 0, 2, 5];

const PIN_ROWS = [[9], [8, 7], [6, 5, 4], [3, 2, 1, 0]];

interface PinSlot {
  pin: number;
  row: number;
  x: number;
  y: number;
}

function pinSlots(
  startX: number,
  startY: number,
  rowShiftX: number,
  rowShiftY: number,
  spacing: number,
): PinSlot[] {
  return PIN_ROWS.flatMap((pins, row) => {
    const rowX = startX - row * rowShiftX;
    const y = startY - row * rowShiftY;

    return pins.map((pin, column) => {
      const x = rowX + column * spacing;

      return { pin, row, x, y };
    });
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function addCels(scene: Scene, sprite: Sprite, bitmaps: string[]): void {
  for (const bitmap of bitmaps) {
    scene.addCel(sprite, bitmap);
  }
}

function addFlySequence(body: Sprite, flyCel: number, landCel: number): void {
  body.newSequence(1);

  for (const dy of FLY_DY) {
    body.addSteps(flyCel, 1, 1, 0, dy, 30);
  }

  body.addSteps(landCel, 1, 1, 0, 30, 30);
}

function buildRacker(scene: Scene, racker: Sprite, x: number, y: number): void {
  scene.addCel(racker, "OneRackerHead.bmp");
  racker.noParm = true;
  racker.setAllCelsMode(2);
  racker.setHome(x - 2, y - 454);
  racker.newSequence(1);
  racker.addSteps(1, 2, 1, 0, -4, 50);
  racker.addSteps(1, 2, 1, 0, 4, 50);
  racker.addSteps(1, 1, 1, 0, 0, 200);
  racker.newSequence(1);
  racker.addSteps(1, 2, 1, 0, -4, 50);
  racker.addSteps(1, 1, 1, 0, 0, 200);
  racker.addSteps(1, 24, 1, 0, -12, 30);
}

function buildHead(scene: Scene, head: Sprite, x: number, y: number): void {
  addCels(scene, head, [
    "ElfSmoke2.bmp",
    "Elf2.bmp",
    "ElfHeadBack.bmp",
    "BloodyNeck1.bmp",
    "BloodyNeck2.bmp",
    "ElfHeadBlush.bmp",
    "ElfFart.bmp",
  ]);
  scene.setTalkOverlay(head, "Elf0 Talk.bmp", 0);
  scene.setTalkOverlay(head, "Elf0 Talk.bmp", 1);
  scene.setTalkOverlay(head, "Elf0 Talk.bmp", 2);
  head.noParm = true;
  head.setAllCelsMode(1);
  head.setHome(x, y);
  head.newSequence(1);

  for (let step = 0; step < 7; step++) {
    const cel = step % 2 === 0 ? 2 : 0;

    head.addSteps(cel, 1, 1, 0, 0, 100);
  }
}

function buildArms(scene: Scene, arms: Sprite, x: number, y: number): void {
  addCels(scene, arms, [
    "Arms Flail.bmp",
    "Elf ArmsSmoke1.bmp",
    "Elf ArmsSmoke2.bmp",
    "ArmsDance1.bmp",
    "ArmsDance1Rx.bmp",
    "Arms Scared.bmp",
    "Arms Scared2.bmp",
    "Elf ArmsSign1a.bmp",
    "Elf ArmsSign1b.bmp",
    "Elf ArmsSign2a.bmp",
    "Elf ArmsSign2b.bmp",
    "Arms Sign3.bmp",
    "Arms Sign3b.bmp",
    "Elf Arms Ass.bmp",
    "ArmsHoldNose.bmp",
  ]);
  arms.noParm = true;
  arms.setAllCelsMode(2);
  arms.newSequence(1);

  for (let step = 0; step < 8; step++) {
    const cel = step % 2 === 0 ? 5 : 4;

    arms.addSteps(cel, 1, 1, 0, 0, 250);
  }

  arms.setHome(x, y);
}

function buildBody(scene: Scene, body: Sprite, x: number, y: number): void {
  addCels(scene, body, [
    "Elf Body Kick.bmp",
    "Elf Body Back.bmp",
    "Elf Body Ass.bmp",
    "ElfBodySideStep.bmp",
    "ElfBodySideStepRx.bmp",
    "ElfFly0.bmp",
    "ElfFallBackRX.bmp",
    "ElfDead0.bmp",
    "ElfDead1.bmp",
    "ElfFly0RX.bmp",
    "ElfFallBack.bmp",
    "ElfDead0RX.bmp",
    "ElfDead1RX.bmp",
  ]);
  body.noParm = true;
  body.setAllCelsMode(2);
  addFlySequence(body, 6, 8);
  addFlySequence(body, 7, 9);
  addFlySequence(body, 10, 12);
  addFlySequence(body, 11, 13);
  body.newSequence(1);
  body.addSteps(4, 1, 1, 0, 0, 60);
  body.addSteps(0, 1, 1, 30, 0, 60);
  body.addSteps(4, 1, 1, 0, 0, 60);
  body.addSteps(0, 1, 1, 30, 0, 60);
  body.addSteps(4, 1, 1, 0, 0, 60);
  body.addSteps(0, 1, 1, 30, 0, 200);
  body.addSteps(4, 1, 1, -30, 0, 80);
  body.addSteps(0, 1, 1, 0, 0, 80);
  body.addSteps(4, 1, 1, -30, 0, 80);
  body.addSteps(0, 1, 1, 0, 0, 80);
  body.addSteps(4, 1, 1, -30, 0, 80);
  body.addSteps(0, 1, 1, 0, 0, 80);
  body.newSequence(1);

  for (let round = 0; round < 2; round++) {
    body.addSteps(4, 1, 1, 0, 0, 250);
    body.addSteps(0, 1, 1, 0, 0, 250);
    body.addSteps(5, 1, 1, 0, 0, 250);
    body.addSteps(0, 1, 1, 0, 0, 250);
  }

  body.newSequence(1);

  HOP_DY.forEach((dy, index) => {
    const cel = index % 2 === 0 ? 4 : 5;

    body.addSteps(cel, 1, 1, 0, dy, 30);
  });

  body.addSteps(0, 1, 1, 0, 16, 30);
  body.setHome(x, y);
}

function createRightElves(scene: Scene): number[] {
  const rowThresholds = [0, 0, 0, 0];

  scene.addSprite("RightSceneR", "RightSceneBottomRX.bmp");
  scene.addSprite("RightSceneL", "RightSceneBottom.bmp");

  const rowStarts = new Map<number, string>([
    [0, "RightBall00"],
    [4, "RightBall01"],
    [7, "RightBall02"],
    [9, "RightBall03"],
  ]);

  for (let pin = 0; pin < 10; pin++) {
    const ballName = rowStarts.get(pin);

    if (ballName) {
      scene.addSprite(ballName, "Ball120.bmp");
    }

    const suffix = pad2(pin);

    scene.addSprite(`Elf${suffix} Body`, "Elf Body0.bmp");
    scene.addSprite(`Elf${suffix}`, "Elf0.bmp");
    scene.addSprite(`Elf${suffix} Arms`, "Elf ArmsNothing.bmp");
    scene.addSprite(`Racker${suffix}`, "OneRacker.bmp");
  }

  scene.addSprite("RightBall04", "Ball120.bmp");

  for (const slot of pinSlots(480, 290, 35, 30, 70)) {
    const suffix = pad2(slot.pin);
    const head = scene.find(`Elf${suffix}`);
    const arms = scene.find(`Elf${suffix} Arms`);
    const body = scene.find(`Elf${suffix} Body`);
    const racker = scene.find(`Racker${suffix}`);
    const parts = [head, arms, body, racker];

    for (const part of parts) {
      part.userData = slot.pin;
    }

    body.attached = head;
    head.attached = arms;
    buildRacker(scene, racker, slot.x, slot.y);
    buildHead(scene, head, slot.x, slot.y);
    buildArms(scene, arms, slot.x, slot.y);
    buildBody(scene, body, slot.x, slot.y);

    const bottom = body.screenRect().b;
    const thresholdIndex = PIN_ROWS.length - 1 - slot.row;

    rowThresholds[thresholdIndex] = bottom - 35;
  }

  for (let index = 0; index < 5; index++) {
    const ball = scene.find(`RightBall${pad2(index)}`);

    addCels(scene, ball, ["Ball110.bmp", "Ball100.bmp", "Ball90.bmp"]);
  }

  return rowThresholds;
}

function createLeftElves(scene: Scene): void {
  scene.addSprite("Rake", "Rake.bmp");
  scene.addSprite("LeftSceneL", "LeftSceneBottom.bmp");
  scene.addSprite("LeftSceneR", "LeftSceneBottomRX.bmp");
  scene.addSprite("xMarker", "MarkerOff.bmp");

  for (let index = 0; index < 15; index++) {
    scene.addSprite(`Marker${pad2(index)}`, "MarkerOff.bmp");
  }

  for (let index = 0; index < 15; index++) {
    const marker = scene.find(`Marker${pad2(index)}`);

    marker.userData = index;
    addCels(scene, marker, ["MarkerHalf.bmp", "MarkerOn.bmp"]);
    marker.noParm = true;
    marker.setAllCelsMode(1);
    marker.setHome(76 + index * 12, 385);
  }

  const leftBallRows = new Map<number, string>([
    [0, "LeftBall00"],
    [4, "LeftBall01"],
    [7, "LeftBall02"],
    [9, "LeftBall03"],
  ]);

  for (let pin = 0; pin < 10; pin++) {
    const ballName = leftBallRows.get(pin);

    if (ballName) {
      scene.addSprite(ballName, "Ball100.bmp");
    }

    const suffix = pad2(pin);
    const partNames = [`Elf${suffix} Body`, `Elf${suffix}`, `Elf${suffix} Arms`, `Racker${suffix}`];

    for (const partName of partNames) {
      const source = scene.find(partName);
      const clone = scene.addQuarterClone(`#${partName}`, source);

      clone.copySequencesFrom(source, 4);
    }
  }

  positionLeftElves(scene);
}

function positionLeftElves(scene: Scene): void {
  for (const slot of pinSlots(160, 236, 9, 7, 18)) {
    const suffix = pad2(slot.pin);
    const head = scene.find(`#Elf${suffix}`);
    const arms = scene.find(`#Elf${suffix} Arms`);
    const body = scene.find(`#Elf${suffix} Body`);
    const racker = scene.find(`#Racker${suffix}`);
    const parts = [head, arms, body, racker];

    for (const part of parts) {
      part.userData = slot.pin;
      part.noParm = true;
    }

    body.attached = head;
    head.attached = arms;
    racker.setAllCelsMode(2);
    racker.setHome(slot.x, slot.y - 114);
    head.setAllCelsMode(1);
    head.setHome(slot.x, slot.y);
    arms.setAllCelsMode(2);
    arms.setHome(slot.x, slot.y);
    body.setAllCelsMode(2);
    body.setHome(slot.x, slot.y);
  }
}

function createDeer(scene: Scene): void {
  scene.addSprite("LeftRake", "#Rake.bmp");
  scene.addSprite("LeftSceneTopL", "LeftSceneTop.bmp");
  scene.addSprite("LeftSceneTopR", "LeftSceneTopRX.bmp");

  const deer = scene.addSprite("Deer", "Deer1.bmp");

  addCels(scene, deer, ["Deer2.bmp", "Deer3.bmp", "DeerFall.bmp", "DeerDead.bmp"]);
  deer.newSequence(1);
  deer.addSteps(0, 8, 3, 4, 0, 100);
  deer.newSequence(1);
  deer.addSteps(3, 1, 2, 0, 0, 1000);

  const deerHead = scene.addSprite("DeerHead", "DeerHeadWalk.bmp");

  scene.addCel(deerHead, "DeerHeadLook.bmp");
  deer.attached = deerHead;

  const deerBall = scene.addSprite("DeerBall", "Ball50.bmp");

  addCels(scene, deerBall, ["Ball40.bmp", "Ball30.bmp", "Ball30Snow.bmp"]);
  deerBall.newSequence(1);

  const toDeer: [number, number][] = [
    [0, -30],
    [0, -24],
    [0, -18],
    [1, -12],
    [1, -6],
    [1, 0],
    [2, 6],
    [2, 12],
  ];

  for (const [cel, dy] of toDeer) {
    deerBall.addSteps(cel, 1, 1, -2, dy, 40);
  }

  deerBall.newSequence(1);

  const bounceAway: [number, number][] = [
    [2, -16],
    [2, -10],
    [2, -4],
    [2, 0],
    [2, 4],
    [2, 10],
    [2, 16],
    [2, 22],
    [3, 28],
    [3, 30],
  ];

  for (const [cel, dy] of bounceAway) {
    deerBall.addSteps(cel, 1, 1, -1, dy, 40);
  }

  for (let index = 0; index < 3; index++) {
    const turd = scene.addSprite(`Turd${pad2(index)}`, "Turds1.bmp");

    addCels(scene, turd, ["Turds2.bmp", "Turds3.bmp"]);
  }
}

function addKalvinHop(kalvin: Sprite, celBase: number, dx: number, lastDuration: number): void {
  KALVIN_HOP_DY.forEach((dy, index) => {
    const cel = index < 3 ? celBase + 1 : celBase + 2;

    kalvin.addSteps(cel, 1, 1, dx, dy, 30);
  });

  kalvin.addSteps(celBase, 1, 1, dx, 10, lastDuration);
}

function addKalvinSequences(kalvin: Sprite, rightBase: number, leftBase: number): void {
  kalvin.newSequence(1);
  addKalvinHop(kalvin, rightBase, 10, 800);
  addKalvinHop(kalvin, rightBase, 10, 800);
  addKalvinHop(kalvin, leftBase, -10, 800);
  addKalvinHop(kalvin, rightBase, 10, 800);
  kalvin.newSequence(1);
  addKalvinHop(kalvin, rightBase, 9, 800);
  addKalvinHop(kalvin, rightBase, 9, 1600);
  kalvin.newSequence(1);
  addKalvinHop(kalvin, rightBase, 8, 800);
  addKalvinHop(kalvin, rightBase, 8, 1600);
  kalvin.newSequence(1);
  addKalvinHop(kalvin, leftBase, -10, 800);
  addKalvinHop(kalvin, leftBase, -10, 800);
  addKalvinHop(kalvin, rightBase, 10, 800);
  addKalvinHop(kalvin, leftBase, -10, 800);
  kalvin.newSequence(1);
  addKalvinHop(kalvin, leftBase, -10, 800);
  addKalvinHop(kalvin, leftBase, -10, 1600);
  kalvin.newSequence(6);
  addKalvinHop(kalvin, leftBase, -12, 30);
}

function createCritters(scene: Scene): void {
  const kalvin = scene.addSprite("Kalvin", "Kalvin Hop A.bmp");

  addCels(scene, kalvin, [
    "Kalvin Hop B.bmp",
    "Kalvin Hop C.bmp",
    "Kalvin Hop ARX.bmp",
    "Kalvin Hop BRX.bmp",
    "Kalvin Hop CRX.bmp",
    "KalvinDead.bmp",
    "Bunny1.bmp",
    "Bunny2.bmp",
    "Bunny3.bmp",
    "Bunny1RX.bmp",
    "Bunny2RX.bmp",
    "Bunny3RX.bmp",
  ]);
  addKalvinSequences(kalvin, 0, 3);
  addKalvinSequences(kalvin, 7, 10);

  const bird = scene.addSprite("Bird", "Bird1.bmp");

  addCels(scene, bird, [
    "Bird2.bmp",
    "Bird3.bmp",
    "BirdFrog1.bmp",
    "BirdFrog2.bmp",
    "BirdFrog3.bmp",
  ]);
  scene.addSprite("LeftBall04", "Ball100.bmp");

  for (let index = 0; index < 5; index++) {
    const ball = scene.find(`LeftBall${pad2(index)}`);

    addCels(scene, ball, [
      "Ball90.bmp",
      "Ball80.bmp",
      "Ball70.bmp",
      "Ball60.bmp",
      "Ball50.bmp",
      "Ball40.bmp",
      "Ball30.bmp",
      "Ball20.bmp",
      "Ball10.bmp",
      "Ball00.bmp",
      "Ball-10.bmp",
    ]);
  }
}

function createScoreboard(scene: Scene): void {
  scene.addSprite("BackWallR", "RightSceneTopRX.bmp");
  scene.addSprite("BackWallL", "RightSceneTop.bmp");
  scene.addSprite("BlackLine", "BlackLine.bmp");
  scene.addSprite("PinsBoard", "PinsBoard.bmp");

  for (let index = 0; index < 2; index++) {
    const marker = scene.addSprite(`BallMarker${index}`, "BallOff.bmp");

    scene.addCel(marker, "BallOn.bmp");
  }

  for (let index = 0; index < 10; index++) {
    const marker = scene.addSprite(`ElfMarker${pad2(index)}`, "ElfMarker.bmp");

    scene.addCel(marker, "ElfMarkerOn.bmp");
  }

  scene.addSprite("Scoreboard", "Scoreboard.bmp");

  const lights = scene.addSprite("LightsOn", "LightsOff.bmp");

  scene.addCel(lights, "LightsOn.bmp");

  for (let index = 0; index < 10; index++) {
    const bitmap = index === 9 ? "ScoreBoxLast.bmp" : "ScoreBox.bmp";

    scene.addSprite(`Score${pad2(index)}`, bitmap);
  }

  for (let index = 0; index < 10; index++) {
    createScoreTexts(scene, index);
  }
}

function createScoreTexts(scene: Scene, index: number): void {
  const isLast = index === 9;
  const box = scene.find(`Score${pad2(index)}`);
  const highlight = isLast ? "ScoreBoxLast2.bmp" : "ScoreBox2.bmp";

  scene.addCel(box, highlight);
  box.userData = index;

  const total = scene.addTextSprite(`ScoreText${pad2(index)}`, box, 2, 0, 0, 10, 0);

  total.sprite.userData = index;
  total.sprite.noParm = true;
  total.text.color = 0;

  const markAInsets = isLast ? [4, 18, -1, 12] : [13, 9, -1, 12];
  const markBInsets = isLast ? [13, 9, -1, 12] : [22, 0, -1, 12];
  const markNames: [string, number[]][] = [
    [`ScoreMarkA${pad2(index)}`, markAInsets],
    [`ScoreMarkB${pad2(index)}`, markBInsets],
  ];

  if (isLast) {
    markNames.push(["ScoreMarkC09", [22, 0, -1, 12]]);
  }

  for (const [name, insets] of markNames) {
    const mark = scene.addTextSprite(name, box, 2, insets[0], insets[1], insets[2], insets[3]);

    mark.sprite.userData = index;
    mark.sprite.noParm = true;
    mark.text.color = 0;
    mark.text.font = 2;
  }
}

function createSanta(scene: Scene): void {
  const santa = scene.addSprite("Santa", "Santa1.bmp");

  addCels(scene, santa, ["Santa2.bmp", "SantaJoy.bmp", "SantaWalkBack.bmp"]);
  santa.newSequence(4);
  santa.addSteps(2, 4, 1, 0, -5, 30);
  santa.addSteps(2, 4, 1, 0, 5, 30);
  santa.addSteps(2, 1, 1, 0, 0, 30);
  santa.newSequence(6);
  santa.addSteps(3, 4, 1, 0, 8, 30);
  santa.addSteps(3, 1, 1, 0, 0, 140);
}

export function buildGameScene(scene: Scene, onQuit: () => void): number[] {
  const rowThresholds = createRightElves(scene);

  createLeftElves(scene);
  createDeer(scene);
  createCritters(scene);
  createScoreboard(scene);
  createSanta(scene);

  const quit = scene.addButton("Quit", "QuitOn.bmp", "QuitOff.bmp");

  quit.onClick = onQuit;
  scene.addSprite("Hint1a", "Hint1a.bmp");

  return rowThresholds;
}
