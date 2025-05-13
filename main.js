let video = document.getElementById('webcam');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let scene, camera, renderer;
let shapes = [];
let currentShape = null;
let isPinching = false;
let shapeScale = 1;
let originalDistance = null;
let selectedShape = null;
let shapeCreatedThisPinch = false;
let lastShapeCreationTime = 0;
let isDisintegrating = false;
let snapFlashEffect = null;
const shapeCreationCooldown = 1000;

const initThree = () => {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('three-canvas').appendChild(renderer.domElement);
  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);
  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  shapes.forEach(shape => {
    if (shape !== selectedShape) {
      shape.rotation.x += 0.01;
      shape.rotation.y += 0.01;
    }
  });
  renderer.render(scene, camera);
};

const neonColors = [0xFF00FF, 0x00FFFF, 0xFF3300, 0x39FF14, 0xFF0099, 0x00FF00, 0xFF6600, 0xFFFF00];
let colorIndex = 0;

const getNextNeonColor = () => {
    const color = neonColors[colorIndex];
    colorIndex = (colorIndex + 1) % neonColors.length;
    return color;
};

const createRandomShape = (position) => {
  const geometries = [
    new THREE.BoxGeometry(),
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.ConeGeometry(0.5, 1, 32),
    new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
  ];
  const geometry = geometries[Math.floor(Math.random() * geometries.length)];
  const color = getNextNeonColor();
  const group = new THREE.Group();

  const material = new THREE.MeshBasicMaterial({ 
    color: color, 
    transparent: true, 
    opacity: 0.5 
  });
  const fillMesh = new THREE.Mesh(geometry, material);

  const wireframeMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    wireframe: true,
    transparent: true,
    opacity: 1
  });
  const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);

  group.add(fillMesh);
  group.add(wireframeMesh);
  group.position.copy(position);
  scene.add(group);

  shapes.push(group);
  return group;
};

const get3DCoords = (normX, normY) => {
  const x = (normX - 0.5) * 10;
  const y = (0.5 - normY) * 10;
  return new THREE.Vector3(x, y, 0);
};

const isPinch = (landmarks) => {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  return d(landmarks[4], landmarks[8]) < 0.06;
};

const isSnap = (landmarks) => {
  const thumbTip = landmarks[4];
  const middleTip = landmarks[12];
  const distance = Math.hypot(
    thumbTip.x - middleTip.x,
    thumbTip.y - middleTip.y,
    thumbTip.z - middleTip.z
  );
  return distance < 0.03;
};

const areIndexFingersClose = (l, r) => {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return d(l[8], r[8]) < 0.12;
};

const findNearestShape = (position) => {
  let minDist = Infinity;
  let closest = null;
  shapes.forEach(shape => {
    const dist = shape.position.distanceTo(position);
    if (dist < 1.5 && dist < minDist) {
      minDist = dist;
      closest = shape;
    }
  });
  return closest;
};

const disintegrate = (shape, delay = 0) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const particles = [];
      const particleCount = 100;
      const geometries = [
        new THREE.BoxGeometry(0.03, 0.03, 0.03),
        new THREE.SphereGeometry(0.03, 8, 8)
      ];
      const baseColor = shape.children[0].material.color.clone();

      for (let i = 0; i < particleCount; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const colorVariation = 0.2;
        const color = new THREE.Color(
          baseColor.r + (Math.random() * colorVariation - colorVariation / 2),
          baseColor.g + (Math.random() * colorVariation - colorVariation / 2),
          baseColor.b + (Math.random() * colorVariation - colorVariation / 2)
        );

        const material = new THREE.MeshBasicMaterial({ 
          color: color,
          transparent: true,
          opacity: 1
        });

        const particle = new THREE.Mesh(geometry, material);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * shape.scale.x * 0.8,
          (Math.random() - 0.5) * shape.scale.y * 0.8,
          (Math.random() - 0.5) * shape.scale.z * 0.8
        );

        particle.position.copy(shape.position).add(offset);
        particle.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );

        particle.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );

        particle.rotationSpeed = new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        );

        scene.add(particle);
        particles.push(particle);
      }

      shape.visible = false;

      const startTime = Date.now();
      const duration = 2000;

      const animateParticles = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
          particles.forEach(particle => {
            particle.velocity.y -= 0.0005;
            particle.position.add(particle.velocity);

            if (particle.rotationSpeed) {
              particle.rotation.x += particle.rotationSpeed.x;
              particle.rotation.y += particle.rotationSpeed.y;
              particle.rotation.z += particle.rotationSpeed.z;
            }

            particle.material.opacity = 1 - progress;

            if (particle.userData.growsFirst) {
              const scale = progress < 0.3 ? 
                1 + progress : 1 - ((progress - 0.3) / 0.7);
              particle.scale.set(scale, scale, scale);
            } else {
              particle.scale.multiplyScalar(0.99);
            }
          });
          requestAnimationFrame(animateParticles);
        } else {
          particles.forEach(particle => scene.remove(particle));
          scene.remove(shape);
          resolve();
        }
      };

      particles.forEach(particle => {
        particle.userData = {
          growsFirst: Math.random() > 0.7
        };
      });

      animateParticles();
    }, delay);
  });
};

const snapDisintegration = async () => {
  if (isDisintegrating || shapes.length === 0) return;
  isDisintegrating = true;

  createSnapFlash();
  shakeCamera();

  const shapesToDisintegrate = [...shapes];
  shapes = [];

  const disintegrationPromises = shapesToDisintegrate.map((shape, index) => {
    const randomDelay = Math.random() * 500;
    return disintegrate(shape, randomDelay);
  });

  await Promise.all(disintegrationPromises);

  isDisintegrating = false;
};

const createSnapFlash = () => {
  const flashGeometry = new THREE.PlaneGeometry(100, 100);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });

  snapFlashEffect = new THREE.Mesh(flashGeometry, flashMaterial);
  snapFlashEffect.position.z = -10;
  scene.add(snapFlashEffect);

  const startTime = Date.now();
  const duration = 1000;

  const animateFlash = () => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / duration;

    if (progress < 1) {
      snapFlashEffect.material.opacity = 0.8 * (1 - progress);
      requestAnimationFrame(animateFlash);
    } else {
      scene.remove(snapFlashEffect);
      snapFlashEffect = null;
    }
  };

  animateFlash();
};

const shakeCamera = () => {
  const originalPosition = camera.position.clone();
  const startTime = Date.now();
  const duration = 1000;
  const intensity = 0.3;

  const shakeAnimation = () => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / duration;

    if (progress < 1) {
      const decreaseFactor = 1 - progress;

      camera.position.set(
        originalPosition.x + (Math.random() - 0.5) * intensity * decreaseFactor,
        originalPosition.y + (Math.random() - 0.5) * intensity * decreaseFactor,
        originalPosition.z
      );

      requestAnimationFrame(shakeAnimation);
    } else {
      camera.position.copy(originalPosition);
    }
  };

  shakeAnimation();
};

const hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

hands.onResults(results => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const landmarks of results.multiHandLandmarks) {
    const drawCircle = (landmark) => {
      ctx.beginPath();
      ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 10, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.fill();
    };
    drawCircle(landmarks[4]);
    drawCircle(landmarks[8]);
    drawCircle(landmarks[12]);
  }

  if (results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      if (isSnap(landmarks)) {
        snapDisintegration();
        break;
      }
    }
  }

  if (results.multiHandLandmarks.length === 2) {
    const [l, r] = results.multiHandLandmarks;
    const leftPinch = isPinch(l);
    const rightPinch = isPinch(r);
    const indexesClose = areIndexFingersClose(l, r);

    if (leftPinch && rightPinch) {
      const left = l[8];
      const right = r[8];
      const centerX = (left.x + right.x) / 2;
      const centerY = (left.y + right.y) / 2;
      const distance = Math.hypot(left.x - right.x, left.y - right.y);

      if (!isPinching) {
        const now = Date.now();
        if (!shapeCreatedThisPinch && indexesClose && now - lastShapeCreationTime > shapeCreationCooldown) {
          currentShape = createRandomShape(get3DCoords(centerX, centerY));
          lastShapeCreationTime = now;
          shapeCreatedThisPinch = true;
          originalDistance = distance;
        }
      } else if (currentShape && originalDistance) {
        shapeScale = distance / originalDistance;
        currentShape.scale.set(shapeScale, shapeScale, shapeScale);
      }
      isPinching = true;
      return;
    }
  }

  isPinching = false;
  shapeCreatedThisPinch = false;
  originalDistance = null;
  currentShape = null;

  if (results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      const indexTip = landmarks[8];
      const position = get3DCoords(indexTip.x, indexTip.y);

      if (isPinch(landmarks)) {
        if (!selectedShape) {
          selectedShape = findNearestShape(position);
        }
        if (selectedShape) {
          selectedShape.position.copy(position);
        }
      } else {
        selectedShape = null;
      }
    }
  } else {
    selectedShape = null;
  }
});

const initCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = resolve);
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: video.videoWidth,
    height: video.videoHeight
  }).start();
};

initThree();
initCamera();