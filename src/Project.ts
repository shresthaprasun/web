import { AmbientLight, AxesHelper, BoxBufferGeometry, Color, DataTexture, DoubleSide, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, MeshPhongMaterial, Object3D, PerspectiveCamera, Plane, PlaneGeometry, Quaternion, Raycaster, RGBFormat, Scene, SphereBufferGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { VRButton } from "../node_modules/three/examples/jsm/webxr/VRButton";
import { RubiksCube } from './RubiksCube';


//features grab to scale, grab to rotate each side, grabe to rtate all cube

//https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_dragging.html



const EPS = 0.000001;
export class Project {

    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;

    private pointerDown: boolean;
    private pointerMoved: boolean;
    private isModelSelected: boolean;
    private screen: { left: number, top: number, width: number, height: number };

    private target: Vector3;
    private _moveCurr: Vector2;
    private _movePrev: Vector2;
    private _eye: Vector3;
    private rotateSpeed: number;
    private _lastAxis: Vector3;
    private _lastAngle: number;
    private staticMoving: boolean;
    private dynamicDampingFactor: number;

    private raycaster: Raycaster;

    private mouse: Vector2;

    private rubiksCube: RubiksCube;
    private planeForRotation: Plane;
    private pointOnPlane: Vector3;



    constructor() {
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0xFFFFFF, 1);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(60, 1, 0.1, 100);

        const light1 = new AmbientLight(0xffffff);
        this.scene.add(light1)

        this.target = new Vector3(0, 0, 0);
        this._moveCurr = new Vector2();
        this._movePrev = new Vector2();
        this._eye = new Vector3();
        this.rotateSpeed = 2.0;
        this._lastAxis = new Vector3();
        this._lastAngle = 0;
        this.staticMoving = false;
        this.dynamicDampingFactor = 0.2;
        this.screen = { left: 0, top: 0, width: 0, height: 0 };

        this.pointerDown = false;
        this.pointerMoved = false;

        this.raycaster = new Raycaster();
        this.mouse = new Vector2();
        this.isModelSelected = false;
        this.rubiksCube = new RubiksCube();
        this.rubiksCube.applyMatrix4(new Matrix4().makeTranslation(-1, -1, -1).scale(new Vector3(0.5, 0.5, 0.5)));
        this.scene.add(this.rubiksCube);
        this.planeForRotation = new Plane();
        this.pointOnPlane = new Vector3();


    }



    init(container: HTMLElement) {
        this.camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(1, 1, 1);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        // this.camera.aspect = container.clientWidth / container.clientHeight;
        container.appendChild(this.renderer.domElement);

        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        const box = this.renderer.domElement.getBoundingClientRect();
        // adjustments come from similar code in the jquery offset() function
        const d = this.renderer.domElement.ownerDocument.documentElement;

        this.screen.left = box.left + window.pageXOffset - d.clientLeft;
        this.screen.top = box.top + window.pageYOffset - d.clientTop;
        this.screen.width = box.width;
        this.screen.height = box.height;

        this.addEventListeners();

        // const axisHelper = new AxesHelper();
        // axisHelper.position.set(0, 0, 0);
        // this.scene.add(axisHelper);

        // const sphere = new Mesh(new SphereBufferGeometry(0.1), new MeshBasicMaterial({ color: "red" }))
        // sphere.position.set(0, 0, 0);
        // this.scene.add(sphere);
    }





    addEventListeners() {
        this.renderer.domElement.addEventListener("pointerdown", (event) => {
            this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
            this._movePrev.copy(this._moveCurr);
            this.pointerDown = true;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            if (this.rubiksCube.getPlaneOfIntersection(this.raycaster, this.planeForRotation)) {
                this.isModelSelected = true;
                const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
                hit && this.pointOnPlane.copy(hit);
            }
            this.pointerMoved = false;
        });

        this.renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            if (this.isModelSelected) {
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
                if (hit) {
                    const dir = new Vector3().subVectors(hit, this.pointOnPlane);
                    const len = dir.length()
                    if (len > EPS) {
                        this.rubiksCube.rotateLayer(dir);
                        this.pointOnPlane.copy(hit);
                        this.pointerMoved = true;
                    }
                }
            }
            else {
                if (this.pointerDown) {
                    this._movePrev.copy(this._moveCurr);
                    this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
                }
            }
        });

        this.renderer.domElement.addEventListener("pointerup", () => {
            if (this.isModelSelected) {
                this.rubiksCube.snapLayer();
            }
            this.pointerDown = false;
            this.isModelSelected = false;
            this.pointerMoved = false;
        });
    }

    render() {
        this.renderer.clear();
        if (this.pointerDown) {
            this.update();
        }
        this.renderer.render(this.scene, this.camera)
    }

    animate() {
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    getMouseOnCircle(pageX: number, pageY: number) {

        const vector = new Vector2();
        vector.set(
            ((pageX - this.screen.width * 0.5 - this.screen.left) / (this.screen.width * 0.5)),
            ((this.screen.height + 2 * (this.screen.top - pageY)) / this.screen.width) // screen.width intentional
        );
        return vector;
    }



    update() {
        this._eye.subVectors(this.camera.position, this.target);

        this.rotateCamera();

        this.camera.position.addVectors(this.target, this._eye);
        this.camera.lookAt(this.target);


    }

    rotateCamera() {

        const axis = new Vector3(),
            quaternion = new Quaternion(),
            eyeDirection = new Vector3(),
            objectUpDirection = new Vector3(),
            objectSidewaysDirection = new Vector3(),
            moveDirection = new Vector3();


        moveDirection.set(this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0);
        let angle = moveDirection.length();

        if (angle) {

            this._eye.copy(this.camera.position).sub(this.target);

            eyeDirection.copy(this._eye).normalize();
            objectUpDirection.copy(this.camera.up).normalize();
            objectSidewaysDirection.crossVectors(objectUpDirection, eyeDirection).normalize();

            objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y);
            objectSidewaysDirection.setLength(this._moveCurr.x - this._movePrev.x);

            moveDirection.copy(objectUpDirection.add(objectSidewaysDirection));

            axis.crossVectors(moveDirection, this._eye).normalize();

            angle *= this.rotateSpeed;
            quaternion.setFromAxisAngle(axis, angle);

            this._eye.applyQuaternion(quaternion);
            this.camera.up.applyQuaternion(quaternion);

            this._lastAxis.copy(axis);
            this._lastAngle = angle;

            this.camera.updateMatrixWorld();

        } else if (!this.staticMoving && this._lastAngle) {

            this._lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor);
            this._eye.copy(this.camera.position).sub(this.target);
            quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle);
            this._eye.applyQuaternion(quaternion);
            this.camera.up.applyQuaternion(quaternion);

        }
        this._movePrev.copy(this._moveCurr);
    }
}

