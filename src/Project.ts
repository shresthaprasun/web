import { AmbientLight, Audio, AudioListener, AudioLoader, BufferGeometry, Group, Line, Matrix4, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Plane, Quaternion, Raycaster, Scene, SphereBufferGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { VRButton } from "../node_modules/three/examples/jsm/webxr/VRButton";
import { XRControllerModelFactory } from '../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
import { RubiksCube } from './RubiksCube';


//features grab to scale, grab to rotate each side, grabe to rtate all cube

//https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_dragging.html



const EPS = 0.000001;
export class Project {

    private renderer: WebGLRenderer;
    private scene: Scene;
    private camera: PerspectiveCamera;

    private pointerDown: boolean;
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


    private controller1: Group;
    private controller2: Group;
    private controllerGrip1: Group;
    private controllerGrip2: Group;

    private tempMatrix: Matrix4;
    private group: Group;
    private intersected: Object3D[];
    private isselectStart: boolean;

    private audio: Audio;


    constructor() {
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0xFFFFFF, 1);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(60, 1, 0.1, 100);

        const light1 = new AmbientLight(0xffffff);
        this.scene.add(light1)

        this.target = new Vector3(0, 0, -7);
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

        this.raycaster = new Raycaster();
        this.mouse = new Vector2();
        this.isModelSelected = false;
        this.rubiksCube = new RubiksCube();
        this.rubiksCube.applyMatrix4(new Matrix4().makeTranslation(-1, -1, -8));//.scale(new Vector3(0.5, 0.5, 0.5)));
        this.scene.add(this.rubiksCube);
        this.planeForRotation = new Plane();
        this.pointOnPlane = new Vector3();

        this.controller1 = this.renderer.xr.getController(0);
        this.controller2 = this.renderer.xr.getController(1);
        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);

        this.tempMatrix = new Matrix4();
        this.group = new Group();
        this.intersected = [];
        this.isselectStart = false;

        const listener = new AudioListener();
        this.camera.add(listener);
        this.audio = new Audio(listener);
        const audioLoader = new AudioLoader();
        audioLoader.load('rubikscube.wav',  (buffer) => {
            this.audio.setBuffer(buffer);
        });
    }



    init(container: HTMLElement) {
        this.camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        this.camera.up.set(0, 1, 0);
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(0, 0, -1);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        // this.camera.aspect = container.clientWidth / container.clientHeight;
        container.appendChild(this.renderer.domElement);

        this.renderer.xr.enabled = true;
        container.appendChild(VRButton.createButton(this.renderer));

        const box = this.renderer.domElement.getBoundingClientRect();
        // adjustments come from similar code in the jquery offset() function
        const d = this.renderer.domElement.ownerDocument.documentElement;

        this.screen.left = box.left + window.pageXOffset - d.clientLeft;
        this.screen.top = box.top + window.pageYOffset - d.clientTop;
        this.screen.width = box.width;
        this.screen.height = box.height;

        this.addEventListeners();
        this.addXRControllers();

        // const axisHelper = new AxesHelper();
        // axisHelper.position.set(0, 0, 0);
        // this.scene.add(axisHelper);

        // const sphere = new Mesh(new SphereBufferGeometry(0.1), new MeshBasicMaterial({ color: "red" }))
        // sphere.position.set(0, 0, 0);
        // this.scene.add(sphere);
    }

    private addXRControllers() {
        // controllers

        // this.controller1 = this.renderer.xr.getController(0);
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('select', this.onSelect.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller1);

        // this.controller2 = this.renderer.xr.getController(1);
        // this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        // this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller2);

        const controllerModelFactory = new XRControllerModelFactory();

        // this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.scene.add(this.controllerGrip1);

        // this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.scene.add(this.controllerGrip2);

        //
        const geometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 0, - 1)]);

        const line = new Line(geometry);
        line.name = 'line';
        line.scale.z = 5;

        this.controller1.add(line.clone());
        this.controller2.add(line.clone());
    }

    addEventListeners() {
        this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown.bind(this));
        this.renderer.domElement.addEventListener("pointermove", this.onPointerMove.bind(this));
        this.renderer.domElement.addEventListener("pointerup", this.onPointerUp.bind(this));
        this.renderer.domElement.addEventListener("resize", this.onWindowResize.bind(this));
    }

    private onPointerDown(event: PointerEvent) {
        this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
        this._movePrev.copy(this._moveCurr);
        this.pointerDown = true;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        if (this.rubiksCube.getPlaneOfIntersection(this.raycaster, this.planeForRotation)) {
            this.isModelSelected = true;
            this.planeForRotation.applyMatrix4(this.rubiksCube.matrix);
            const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
            hit && this.pointOnPlane.copy(hit);
        }
    }

    private onPointerMove(event: PointerEvent) {
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
                }
            }
        }
        else {
            if (this.pointerDown) {
                this._movePrev.copy(this._moveCurr);
                this._moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
            }
        }
    }

    private onPointerUp() {
        if (this.isModelSelected) {
            this.audio.play();
            this.rubiksCube.snapLayer();
        }
        this.pointerDown = false;
        this.isModelSelected = false;
    }

    private onSelectStart(event) {
        const controller = event.target;
        if (!this.isselectStart) {
            this.tempMatrix.identity().extractRotation(controller.matrixWorld);

            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, - 1).applyMatrix4(this.tempMatrix);

            if (this.rubiksCube.getPlaneOfIntersection(this.raycaster, this.planeForRotation)) {
                this.isModelSelected = true;
                this.planeForRotation.applyMatrix4(this.rubiksCube.matrix);
                const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
                hit && this.pointOnPlane.copy(hit);
            }
        }
        else {
            this.onSelect(event)
        }


        // const intersections = this.getIntersections(controller);

        // if (intersections.length > 0) {

        //     const intersection = intersections[0];

        //     const object = intersection.object;
        //     object["material"].emissive.b = 1;
        //     controller.attach(object);

        //     controller.userData.selected = object;

        // }
    }
    private onSelect(event) {


        if (this.isModelSelected) {
            const controller = event.target;

            this.tempMatrix.identity().extractRotation(controller.matrixWorld);

            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, - 1).applyMatrix4(this.tempMatrix);
            const hit = this.raycaster.ray.intersectPlane(this.planeForRotation, new Vector3());
            if (hit) {
                const dir = new Vector3().subVectors(hit, this.pointOnPlane);
                const len = dir.length()
                if (len > EPS) {
                    this.rubiksCube.rotateLayer(dir);
                    this.pointOnPlane.copy(hit);
                    const sphere = new Mesh(new SphereBufferGeometry(0.6), new MeshBasicMaterial({ color: "red" }))
                    sphere.position.set(0, 0, 0);
                    this.scene.add(sphere);

                }
            }
        }
    }

    private onSelectEnd(event) {
        const controller = event.target;

        if (this.isModelSelected) {
            this.rubiksCube.snapLayer();
        }
        this.isModelSelected = false;
        this.isselectStart = false;
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private getIntersections(controller: Group) {

        this.tempMatrix.identity().extractRotation(controller.matrixWorld);

        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, - 1).applyMatrix4(this.tempMatrix);

        return this.raycaster.intersectObjects(this.group.children, false);

    }

    private intersectObjects(controller: Group) {

        // Do not highlight when already selected

        if (controller.userData.selected !== undefined) return;

        const line = controller.getObjectByName('line');
        const intersections = this.getIntersections(controller);

        if (intersections.length > 0) {

            const intersection = intersections[0];

            const object = intersection.object;
            object["material"].emissive.r = 1;
            this.intersected.push(object);
            if (line)
                line.scale.z = intersection.distance;

        } else {
            if (line)
                line.scale.z = 5;

        }

    }

    private cleanIntersected() {

        while (this.intersected.length) {

            const object = this.intersected.pop();
            if (object)
                object["material"].emissive.r = 0;

        }

    }

    render() {
        // this.renderer.clear();
        this.cleanIntersected();
        this.intersectObjects(this.controller1);
        this.intersectObjects(this.controller2);
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

