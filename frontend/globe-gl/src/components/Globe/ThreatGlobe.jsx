import { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import ThreeGlobe from 'three-globe';
import { useGlobe } from '../../context/GlobeContext';
import * as THREE from 'three';

function GlobeInstance() {
  const { state, dispatch } = useGlobe();
  const [globe, setGlobe] = useState(null);
  const globeRef = useRef();

  useEffect(() => {
    const globeObj = new ThreeGlobe()
      .globeImageUrl(null) // No texture, use solid color
      .showAtmosphere(true)
      .atmosphereColor('#00e5ff')
      .atmosphereAltitude(0.15)
      .polygonCapColor(() => '#1a1f2e')
      .polygonSideColor(() => '#1a1f2e')
      .polygonStrokeColor(() => 'rgba(0, 229, 255, 0.4)')
      .polygonAltitude(0.01)
      .objectLat('lat')
      .objectLng('lng')
      .objectAltitude(0.05);

    // Load GeoJSON
    fetch('//unpkg.com/world-atlas/countries-110m.json')
      .then(res => res.json())
      .then(world => {
        // We need topojson client to convert if it's topojson, but the url is countries-110m.json 
        // Wait, three-globe expects GeoJSON. If it's topojson we have to use topojson-client.
        import('topojson-client').then(topojson => {
          const geojson = topojson.feature(world, world.objects.countries);
          globeObj.polygonsData(geojson.features);
        });
      });

    setGlobe(globeObj);
  }, []);

  useEffect(() => {
    if (globe && state.threatZones.length > 0) {
      // Map threat zones to 3D objects
      const markerData = state.threatZones.map(z => ({
        ...z,
        lat: z.lat,
        lng: z.lng,
        size: 1.5,
        color: z.riskCategory === 'energy' ? '#ff3b3b' : '#00e5ff'
      }));

      globe.objectsData(markerData)
        .objectThreeObject(d => {
          const group = new THREE.Group();
          
          // Core dot
          const geometry = new THREE.SphereGeometry(d.size, 16, 16);
          const material = new THREE.MeshBasicMaterial({ color: d.color });
          const sphere = new THREE.Mesh(geometry, material);
          group.add(sphere);

          // Glow halo
          const haloGeo = new THREE.SphereGeometry(d.size * 2, 16, 16);
          const haloMat = new THREE.MeshBasicMaterial({ 
            color: d.color, 
            transparent: true, 
            opacity: 0.3,
            blending: THREE.AdditiveBlending
          });
          const halo = new THREE.Mesh(haloGeo, haloMat);
          group.add(halo);

          // Interactive area
          sphere.userData = { ...d, isThreatZone: true };

          return group;
        });

      // Update globe materials for solid dark ocean
      const globeMaterial = globe.globeMaterial();
      globeMaterial.color = new THREE.Color('#050a14');
      globeMaterial.emissive = new THREE.Color('#050a14');
      globeMaterial.emissiveIntensity = 0.5;
      globeMaterial.shininess = 0.1;
    }
  }, [globe, state.threatZones]);

  useFrame(() => {
    if (globeRef.current && !state.activeEvent) {
      // Slow rotation when no event is selected
      globeRef.current.rotation.y += 0.001;
    }
  });

  return globe ? (
    <primitive 
      ref={globeRef}
      object={globe} 
      onClick={(e) => {
        // Find if a threat zone was clicked
        if (e.object && e.object.userData && e.object.userData.isThreatZone) {
          dispatch({ type: 'SET_ACTIVE_EVENT', payload: e.object.userData });
        } else {
           // Clicked ocean or land
           dispatch({ type: 'SET_ACTIVE_EVENT', payload: null });
        }
      }}
    />
  ) : null;
}

export default function ThreatGlobe() {
  const controlsRef = useRef();
  const { state } = useGlobe();

  useEffect(() => {
    if (state.activeEvent && controlsRef.current) {
      // Fly to the active event using a simple approximation or standard OrbitControls
      // A more robust flyTo would require animating the camera position, 
      // but for now, the user requested OrbitControls functionality.
    }
  }, [state.activeEvent]);

  return (
    <div className="absolute inset-0 bg-background">
      <Canvas camera={{ position: [0, 0, 300], fov: 45 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[100, 100, 100]} intensity={1} color="#ffffff" />
        <directionalLight position={[-100, -100, -100]} intensity={0.5} color="#00e5ff" />
        
        <GlobeInstance />
        
        <OrbitControls 
          ref={controlsRef}
          enablePan={false} 
          minDistance={120} 
          maxDistance={500} 
          autoRotate={!state.activeEvent}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
