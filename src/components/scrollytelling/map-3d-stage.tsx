"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { buildRdcModel } from "./rdc-outline";

export type Map3DStageHandle = {
  setProgress: (p: number) => void;
};

const PARTICLE_COUNT = 420;
const TILT = -0.35;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

export const Map3DStage = forwardRef<Map3DStageHandle>(function Map3DStage(_props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  useImperativeHandle(ref, () => ({
    setProgress: (p: number) => {
      progressRef.current = p;
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { geometry, kinshasa, nordKivu } = buildRdcModel();
    const tiltAxis = new THREE.Vector3(1, 0, 0);
    const kinshasaVec3 = new THREE.Vector3(kinshasa.x, kinshasa.y, 0.08).applyAxisAngle(tiltAxis, TILT);
    const nordKivuVec3 = new THREE.Vector3(nordKivu.x, nordKivu.y, 0.08).applyAxisAngle(tiltAxis, TILT);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    camera.position.set(0, 0.4, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const material = new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = TILT;
    scene.add(mesh);

    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0 });
    const wireframe = new THREE.LineSegments(wireGeo, wireMat);
    wireframe.rotation.x = TILT;
    scene.add(wireframe);

    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 1.4 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.6;
      particlePositions[i * 3] = Math.cos(theta) * r;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = Math.sin(theta) * r * 0.5;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.03,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    const linePositions: number[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i += 7) {
      const j = (i + 3) % PARTICLE_COUNT;
      linePositions.push(
        particlePositions[i * 3], particlePositions[i * 3 + 1], particlePositions[i * 3 + 2],
        particlePositions[j * 3], particlePositions[j * 3 + 1], particlePositions[j * 3 + 2]
      );
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const networkLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(networkLines);

    const markerGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.copy(nordKivuVec3);
    scene.add(marker);

    const pulseGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0 });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    scene.add(pulse);

    scene.add(new THREE.AmbientLight(0x1e3a8a, 0.6));
    const pointLight = new THREE.PointLight(0x60a5fa, 1.2, 10);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);

    function resize() {
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let raf = 0;
    let running = true;
    let smoothProgress = 0;
    let baseRotation = 0;

    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      smoothProgress += (progressRef.current - smoothProgress) * 0.08;
      const p = smoothProgress;

      const spinSpeed = 0.012 * (1 - smoothstep(0.1, 0.34, p) * 0.85);
      baseRotation += spinSpeed;
      mesh.rotation.y = baseRotation;
      wireframe.rotation.y = baseRotation;
      particles.rotation.y = baseRotation * 0.6;
      networkLines.rotation.y = baseRotation * 0.6;

      const networkIn = smoothstep(0.08, 0.22, p);
      const networkOutForVideo = 1 - smoothstep(0.5, 0.56, p) * (1 - smoothstep(0.8, 0.86, p));
      const networkOpacity = networkIn * Math.max(networkOutForVideo, smoothstep(0.8, 0.9, p));
      wireMat.opacity = networkOpacity * 0.5;
      particleMat.opacity = networkOpacity * 0.85;
      lineMat.opacity = networkOpacity * 0.4;

      const markerIn = smoothstep(0.33, 0.4, p);
      markerMat.opacity = markerIn;
      marker.scale.setScalar(1 + Math.sin(performance.now() * 0.003) * 0.15 * markerIn);

      const travelWindow = smoothstep(0.1, 0.16, p) * (1 - smoothstep(0.32, 0.4, p));
      pulseMat.opacity = travelWindow;
      const t = (performance.now() * 0.00025) % 1;
      pulse.position.lerpVectors(kinshasaVec3, nordKivuVec3, t);

      const camShift = smoothstep(0.24, 0.46, p);
      const targetX = THREE.MathUtils.lerp(0, nordKivuVec3.x * 0.55, camShift);
      const targetY = THREE.MathUtils.lerp(0.4, nordKivuVec3.y * 0.4 + 0.2, camShift);
      const targetZ = THREE.MathUtils.lerp(5.2, 3.6, camShift);
      camera.position.x += (targetX - camera.position.x) * 0.06;
      camera.position.y += (targetY - camera.position.y) * 0.06;
      camera.position.z += (targetZ - camera.position.z) * 0.06;
      camera.lookAt(0, 0, 0);

      const sceneOpacity = Math.max(1 - smoothstep(0.52, 0.58, p) * (1 - smoothstep(0.8, 0.86, p)), 0.15);
      material.emissiveIntensity = 0.25 * sceneOpacity + 0.05;
      mesh.visible = sceneOpacity > 0.02;

      renderer.render(scene, camera);
    }
    frame();

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !running) {
          running = true;
          frame();
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.01 }
    );
    io.observe(container);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      markerGeo.dispose();
      markerMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
});
