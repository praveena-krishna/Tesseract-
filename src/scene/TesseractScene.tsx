import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Lighting } from './Lighting';
import { Effects } from './Effects';
import { Tesseract } from './Tesseract/Tesseract';
import { TraineeField } from './Trainees/TraineeField';
import { TeamField } from './Teams/TeamField';
import { Atmosphere } from './Environment/Atmosphere';
import { Particles } from './Environment/Particles';
import { CameraController } from '../interaction/CameraController';
import { ReadyGate } from './ReadyGate';
import { PALETTE } from '../config/palette';
import { ATMOSPHERE } from '../config/dimensions';

/**
 * Everything that lives inside the canvas.
 *
 * Fog is the quiet workhorse here: matched to the background colour, it makes
 * the far side of the structure recede into the void so the nested shells read
 * as separated in depth rather than as overlapping outlines.
 */
export function TesseractScene() {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(PALETTE.FOG, ATMOSPHERE.FOG_DENSITY);
    scene.background = new THREE.Color(PALETTE.BG);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return (
    <>
      <ReadyGate />
      <CameraController />
      <Lighting />
      <Atmosphere />
      <Tesseract />
      {/*
        Collaboration is drawn before the vessels so the links and project cores
        sit behind the glass they connect, which is where they physically are.
      */}
      <TeamField />
      <TraineeField />
      <Particles />
      <Effects />
    </>
  );
}
