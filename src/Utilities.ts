import { Object3D, Vector3, Matrix4, Quaternion } from "three";

export function rotateAboutPoint(obj: Object3D, point: Vector3, axis: Vector3, theta: number) {
    const untranslateVector = new Vector3().copy(point).negate();
    const untranslateMatrix = new Matrix4().makeTranslation(untranslateVector.x, untranslateVector.y, untranslateVector.z)
    const translateVector = untranslateVector.negate();
    const translateMatrix = new Matrix4().makeTranslation(translateVector.x, translateVector.y, translateVector.z)
    const quaternion = new Quaternion().setFromAxisAngle(axis, theta);
    const matrix = new Matrix4().makeRotationFromQuaternion(quaternion).multiply(untranslateMatrix);
    matrix.premultiply(translateMatrix);
    obj.applyMatrix4(matrix);
}

export function mapToAxisAlignedVector(mouseDir: Vector3, planeNormal: Vector3): Vector3 {
    const result = new Vector3();
    const v = mouseDir.clone();
    const filter = new Vector3().copy(planeNormal).multiply(planeNormal);
    filter.copy(new Vector3(1, 1, 1).sub(filter));
    v.multiply(filter).multiply(filter);
    if (Math.abs(v.x) > Math.abs(v.y)) {
        if (Math.abs(v.x) > Math.abs(v.z)) {
            result.setX(v.x > 0 ? 1 : -1);
        }
        else {
            result.setZ(v.z > 0 ? 1 : -1);
        }
    }
    else {
        if (Math.abs(v.y) > Math.abs(v.z)) {
            result.setY(v.y > 0 ? 1 : -1);
        }
        else {
            result.setZ(v.z > 0 ? 1 : -1);
        }
    }
    return result;
}