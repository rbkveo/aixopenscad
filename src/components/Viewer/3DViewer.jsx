import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { Camera, Axis3D, Move, Target, LayoutGrid } from 'lucide-react';

const ThreeDViewer = forwardRef(({ stlData }, ref) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const axesRef = useRef(null);

    const [showAxes, setShowAxes] = useState(true);
    const [controlMode, setControlMode] = useState('orbit'); // 'orbit' or 'pan'

    // Track current data to avoid redundant updates
    const lastStlDataRef = useRef(null);

    useImperativeHandle(ref, () => ({
        captureScreenshot(forAI = true) {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return null;
            // Force render
            rendererRef.current.render(sceneRef.current, cameraRef.current);

            const originalCanvas = rendererRef.current.domElement;

            if (forAI) {
                // Resize for AI model (Target: 800x600)
                const targetWidth = 800;
                const targetHeight = 600;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 0, 0, targetWidth, targetHeight);
                return tempCanvas.toDataURL('image/jpeg', 0.8);
            } else {
                // Full resolution for user
                return originalCanvas.toDataURL('image/png');
            }
        },
        downloadScreenshot() {
            const dataUrl = this.captureScreenshot(false);
            const link = document.createElement('a');
            link.download = `aix-openscad-export-${new Date().toISOString().slice(0, 19)}.png`;
            link.href = dataUrl;
            link.click();
        }
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        // SCENE
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f1115);
        sceneRef.current = scene;

        // CAMERA
        const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
        camera.position.set(5, 5, 5);
        cameraRef.current = camera;

        // RENDERER
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        const container = containerRef.current;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // CONTROLS
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;

        // LIGHTS
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // HELPERS
        const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        grid.name = "GRID";
        scene.add(grid);

        const axes = new THREE.AxesHelper(50);
        axes.name = "AXES";
        axes.visible = showAxes;
        axes.material.depthTest = false;
        axes.renderOrder = 999;
        scene.add(axes);
        axesRef.current = axes;

        // CONTENT GROUP
        const mainGroup = new THREE.Group();
        mainGroup.name = "MAIN_CONTENT";
        scene.add(mainGroup);

        // ANIMATION
        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            if (controlsRef.current) controlsRef.current.update();
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                // Rotate placeholder if it exists (tagged by name)
                const p = sceneRef.current.getObjectByName("PLACEHOLDER");
                if (p) p.rotation.y += 0.005;

                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };
        animate();

        const handleResize = () => {
            if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // INITIAL RENDER
        updateScene(stlData);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
            // Clear scene
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
            if (container && renderer.domElement.parentNode) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    // Update Axes visibility
    useEffect(() => {
        if (axesRef.current) {
            axesRef.current.visible = showAxes;
        }
    }, [showAxes]);

    // Update Control Mode
    useEffect(() => {
        if (controlsRef.current) {
            if (controlMode === 'pan') {
                controlsRef.current.mouseButtons = {
                    LEFT: THREE.MOUSE.PAN,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.ROTATE
                };
            } else {
                controlsRef.current.mouseButtons = {
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.PAN
                };
            }
        }
    }, [controlMode]);

    const updateScene = (data) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const mainGroup = scene.getObjectByName("MAIN_CONTENT");
        if (!mainGroup) return;

        // Clear main group
        while (mainGroup.children.length > 0) {
            const child = mainGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
            mainGroup.remove(child);
        }

        if (data) {
            try {
                const loader = new STLLoader();
                const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                const geometry = loader.parse(buffer);
                geometry.computeVertexNormals();
                geometry.center();

                const mesh = new THREE.Mesh(
                    geometry,
                    new THREE.MeshPhongMaterial({ color: 0x3b82f6, shininess: 100, specular: 0x111111 })
                );
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mainGroup.add(mesh);

                // FIT CAMERA
                const box = new THREE.Box3().setFromObject(mesh);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const fov = cameraRef.current.fov * (Math.PI / 180);
                let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.5;
                if (dist === 0) dist = 5;

                cameraRef.current.position.set(dist, dist, dist);
                cameraRef.current.lookAt(0, 0, 0);
                if (controlsRef.current) {
                    controlsRef.current.target.set(0, 0, 0);
                    controlsRef.current.update();
                }
            } catch (err) {
                console.error("3DViewer: Parse error", err);
            }
        } else {
            // Add placeholder
            const placeholder = new THREE.Mesh(
                new THREE.BoxGeometry(2, 2, 2),
                new THREE.MeshPhongMaterial({ color: 0x252a33, transparent: true, opacity: 0.8 })
            );
            placeholder.name = "PLACEHOLDER";
            mainGroup.add(placeholder);

            cameraRef.current.position.set(5, 5, 5);
            cameraRef.current.lookAt(0, 0, 0);
            if (controlsRef.current) {
                controlsRef.current.target.set(0, 0, 0);
                controlsRef.current.update();
            }
        }
    };

    useEffect(() => {
        if (stlData !== lastStlDataRef.current) {
            updateScene(stlData);
            lastStlDataRef.current = stlData;
        }
    }, [stlData]);

    const ControlButton = ({ icon: Icon, onClick, active, title }) => (
        <button
            onClick={onClick}
            title={title}
            className={`p-2 rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} className="viewer-container group">
            {/* Legend Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none select-none z-10">
                <div className="bg-slate-900/40 backdrop-blur-sm px-3 py-1 rounded text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    3D Preview
                </div>
            </div>

            {/* Controls Overlay */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 transition-opacity duration-300">
                <div className="flex bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700/50 shadow-xl">
                    <ControlButton
                        icon={Target}
                        onClick={() => setControlMode('orbit')}
                        active={controlMode === 'orbit'}
                        title="Orbit Mode (Left Click)"
                    />
                    <ControlButton
                        icon={Move}
                        onClick={() => setControlMode('pan')}
                        active={controlMode === 'pan'}
                        title="Pan Mode (Left Click)"
                    />
                </div>

                <div className="flex bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700/50 shadow-xl">
                    <ControlButton
                        icon={Axis3D}
                        onClick={() => setShowAxes(!showAxes)}
                        active={showAxes}
                        title="Toggle Axes"
                    />
                    <ControlButton
                        icon={Camera}
                        onClick={() => {
                            const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
                            const link = document.createElement('a');
                            link.download = `stl-capture-${Date.now()}.png`;
                            link.href = dataUrl;
                            link.click();
                        }}
                        title="Save Screenshot"
                    />
                </div>
            </div>

            {/* Axes Legend (When axes are shown) */}
            {showAxes && (
                <div className="absolute bottom-4 left-4 flex gap-3 pointer-events-none">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-500 font-bold bg-black/30 px-2 py-0.5 rounded">
                        <div className="w-2 h-0.5 bg-red-500" /> X
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-500 font-bold bg-black/30 px-2 py-0.5 rounded">
                        <div className="w-2 h-0.5 bg-green-500" /> Y
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-500 font-bold bg-black/30 px-2 py-0.5 rounded">
                        <div className="w-2 h-0.5 bg-blue-500" /> Z
                    </div>
                </div>
            )}
        </div>
    );
});

export default ThreeDViewer;
