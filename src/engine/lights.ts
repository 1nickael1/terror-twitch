import { AmbientLight, Object3D, PointLight, SpotLight, Vector3, type Camera, type Scene } from 'three';

export interface LightSettings {
  ambient: number;
  ambientColor: number;
  fluorescent: number;
  fluorescentColor: number;
  /** 0 = estável, 1 = metade das luminárias piscando forte */
  flicker: number;
  alarm: number;
  flashlight: number;
  flashlightShadows: boolean;
  flashlightAngle: number;
  infrared: number;
  muzzle: number;
}

export const NEUTRAL_LIGHTS: LightSettings = {
  ambient: 0.25,
  ambientColor: 0x9aa4b0,
  fluorescent: 10,
  fluorescentColor: 0xdfe8ff,
  flicker: 0.3,
  alarm: 20,
  flashlight: 0,
  flashlightShadows: false,
  flashlightAngle: 0.45,
  infrared: 0,
  muzzle: 30,
};

/** Posição do cano da arma no espaço da câmera (usada pela luz e pelo flash). */
export const MUZZLE_LOCAL = new Vector3(0.17, -0.15, -0.55);

export class LightRig {
  readonly ambient = new AmbientLight();
  readonly fluorescents: PointLight[];
  readonly alarm: SpotLight | null = null;
  readonly flashlight = new SpotLight(0xfff2d8, 0, 30, 0.45, 0.45, 2);
  readonly infrared = new PointLight(0xffffff, 0, 22, 1.2);
  readonly muzzle = new PointLight(0xffc070, 0, 10, 2);
  private readonly alarmTarget = new Object3D();
  private readonly flashTarget = new Object3D();
  private readonly alarmBase: Vector3 | null;
  private settings: LightSettings = { ...NEUTRAL_LIGHTS };
  private muzzleTime = 0;
  private readonly tmpPos = new Vector3();
  private readonly tmpDir = new Vector3();

  constructor(scene: Scene, camera: Camera, fluorescentPositions: Vector3[], alarmPosition: Vector3 | null) {
    scene.add(this.ambient);
    this.fluorescents = fluorescentPositions.map((p) => {
      const l = new PointLight(0xffffff, 0, 14, 2);
      l.position.copy(p);
      scene.add(l);
      return l;
    });
    this.alarmBase = alarmPosition ? alarmPosition.clone() : null;
    if (alarmPosition) {
      const a = new SpotLight(0xff1a1a, 0, 12, 0.6, 0.5, 2);
      a.position.copy(alarmPosition);
      a.target = this.alarmTarget;
      scene.add(a, this.alarmTarget);
      this.alarm = a;
    }
    // à esquerda e um pouco acima: a arma (canto inferior direito) fica fora do cone e não estoura
    this.flashlight.position.set(-0.25, 0.1, 0.05);
    this.flashlight.target = this.flashTarget;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 25;
    this.flashlight.shadow.bias = -0.0005;
    scene.add(this.flashTarget);
    this.muzzle.position.copy(MUZZLE_LOCAL);
    camera.add(this.flashlight, this.infrared, this.muzzle);
    this.apply({});
  }

  get current(): LightSettings {
    return this.settings;
  }

  /** Aplica sobre o estado neutro (o que não for informado volta ao neutro). */
  apply(s: Partial<LightSettings>): void {
    this.settings = { ...NEUTRAL_LIGHTS, ...s };
    const st = this.settings;
    this.ambient.color.setHex(st.ambientColor);
    this.ambient.intensity = st.ambient;
    for (const l of this.fluorescents) l.color.setHex(st.fluorescentColor);
    this.flashlight.castShadow = st.flashlightShadows;
    this.flashlight.angle = st.flashlightAngle;
  }

  flashMuzzle(): void {
    this.muzzleTime = 0.06;
  }

  update(t: number, dt: number, camera: Camera): void {
    const st = this.settings;
    this.fluorescents.forEach((l, i) => {
      let m = 1;
      if (i % 2 === 1) {
        const off = Math.sin(t * 23 + i * 7.1) > 0.82 || Math.sin(t * 2.3 + i) > 0.96;
        m = off ? 0.1 : 1;
      }
      l.intensity = st.fluorescent * (1 - st.flicker * (1 - m));
    });
    if (this.alarm && this.alarmBase) {
      this.alarm.intensity = st.alarm;
      this.alarmTarget.position.set(
        this.alarmBase.x + Math.cos(t * 3) * 2.5,
        0,
        this.alarmBase.z + Math.sin(t * 3) * 2.5,
      );
    }
    this.flashlight.intensity = st.flashlight;
    camera.getWorldPosition(this.tmpPos);
    camera.getWorldDirection(this.tmpDir);
    this.tmpPos.addScaledVector(this.tmpDir, 6);
    this.flashTarget.position.lerp(this.tmpPos, 1 - Math.exp(-dt * 10));
    this.infrared.intensity = st.infrared;
    this.muzzleTime -= dt;
    this.muzzle.intensity = this.muzzleTime > 0 ? st.muzzle : 0;
  }
}
