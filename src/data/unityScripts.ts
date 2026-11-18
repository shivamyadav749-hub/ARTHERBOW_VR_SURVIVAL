import { CalibrationSettings, DEFAULT_CALIBRATION_SETTINGS } from '../types/archery';

export interface UnityScriptDocument {
  id: string;
  fileName: string;
  className: string;
  roleSummary: string;
  keyHighlights: string[];
  code: string;
}

export function generateCalibrationCSharpSnippet(settings: CalibrationSettings): string {
  const ipdMeters = (settings.virtualIpdMm / 1000).toFixed(4);
  const offX = (settings.stringHandOffsetCm.x / 100).toFixed(3);
  const offY = (settings.stringHandOffsetCm.y / 100).toFixed(3);
  const offZ = (settings.stringHandOffsetCm.z / 100).toFixed(3);
  const domSign = settings.dominantEye === 'right' ? '1f' : '-1f';

  return `using UnityEngine;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    /// <summary>
    /// Applies player-calibrated Virtual IPD and controller-to-string hand offsets
    /// to the Meta Quest XR Rig / OVRCameraRig and VRBowController.
    /// </summary>
    public class VRPlayerRigCalibration : MonoBehaviour
    {
        [Header("XR Rig & Eye Anchors")]
        [SerializeField] private Camera centerEyeCamera;
        [SerializeField] private Transform leftEyeAnchor;
        [SerializeField] private Transform rightEyeAnchor;

        [Header("Controller & String Hand Anchors")]
        [SerializeField] private Transform rightControllerTransform;
        [SerializeField] private Transform calibratedStringHandAnchor;
        [SerializeField] private Transform bowGripPivot;

        [Header("Calibrated User Offsets")]
        [Tooltip("Virtual Interpupillary Distance in meters (${settings.virtualIpdMm.toFixed(1)} mm)")]
        [Range(0.054f, 0.074f)]
        [SerializeField] private float virtualIpdMeters = ${ipdMeters}f;

        [Tooltip("Dominant aiming eye (+1 = Right, -1 = Left)")]
        [SerializeField] private float dominantEyeSign = ${domSign}; // ${settings.dominantEye.toUpperCase()} EYE

        [Tooltip("Controller-to-string anchor offset in meters (X:${settings.stringHandOffsetCm.x.toFixed(1)}cm, Y:${settings.stringHandOffsetCm.y.toFixed(1)}cm, Z:${settings.stringHandOffsetCm.z.toFixed(1)}cm)")]
        [SerializeField] private Vector3 controllerToStringOffset = new Vector3(${offX}f, ${offY}f, ${offZ}f);

        private void OnEnable()
        {
            ApplyRigCalibration();
        }

        public void SetCalibration(float ipdMm, bool isRightEyeDominant, Vector3 stringOffsetMeters)
        {
            virtualIpdMeters = Mathf.Clamp(ipdMm * 0.001f, 0.054f, 0.074f);
            dominantEyeSign = isRightEyeDominant ? 1f : -1f;
            controllerToStringOffset = stringOffsetMeters;
            ApplyRigCalibration();
        }

        public void ApplyRigCalibration()
        {
            // 1. Apply Virtual IPD stereo separation to XR camera & eye anchors
            float halfIpd = virtualIpdMeters * 0.5f;
            if (centerEyeCamera != null)
            {
                centerEyeCamera.stereoSeparation = virtualIpdMeters;
            }
            if (leftEyeAnchor != null)
            {
                leftEyeAnchor.localPosition = new Vector3(-halfIpd, 0f, 0f);
            }
            if (rightEyeAnchor != null)
            {
                rightEyeAnchor.localPosition = new Vector3(halfIpd, 0f, 0f);
            }

            // 2. Align bow sight-pin laterally with calibrated dominant eye
            if (bowGripPivot != null)
            {
                Vector3 bowLocal = bowGripPivot.localPosition;
                bowLocal.x = dominantEyeSign * halfIpd * 0.65f;
                bowGripPivot.localPosition = bowLocal;
            }

            // 3. Apply controller-to-string hand offset so Quest ring/grip aligns cleanly with nock
            if (calibratedStringHandAnchor != null && rightControllerTransform != null)
            {
                calibratedStringHandAnchor.SetParent(rightControllerTransform, false);
                calibratedStringHandAnchor.localPosition = controllerToStringOffset;
                calibratedStringHandAnchor.localRotation = Quaternion.identity;
            }
        }
    }
}`;
}

export const UNITY_CSHARP_SCRIPTS: UnityScriptDocument[] = [
  {
    id: 'arrow-type-data',
    fileName: 'ArrowTypeData.cs',
    className: 'ArrowTypeData : ScriptableObject',
    roleSummary:
      'Data-driven ScriptableObject defining per-arrow ballistics (mass, drag, gravity scale, muzzle velocity), damage, visual prefabs, and special impact ability parameters.',
    keyHighlights: [
      'Defines ArrowCategory enum (CarbonBroadhead, ThermiteDetonator, CryoFrostShard, VoltArcSeeker, ChronoSplitVolley)',
      'Separates physical flight constants (mass, dragCoefficient, gravityMultiplier) from impact payload data (blastRadius, freezeDuration, chainCount)',
      'Configures OVR/XR haptic impulse profiles per arrow type for authentic Meta Quest controller feedback',
    ],
    code: `using UnityEngine;

namespace MetaQuestArchery
{
    public enum ArrowCategory
    {
        CarbonBroadhead = 0,
        ThermiteDetonator = 1,
        CryoFrostShard = 2,
        VoltArcSeeker = 3,
        ChronoSplitVolley = 4
    }

    /// <summary>
    /// Data-driven definition for each selectable arrow archetype in Meta Quest VR.
    /// Create assets via: Right-Click -> Create -> VR Archery -> Arrow Type Data.
    /// </summary>
    [CreateAssetMenu(fileName = "NewArrowType", menuName = "VR Archery/Arrow Type Data", order = 1)]
    public class ArrowTypeData : ScriptableObject
    {
        [Header("Identity & UI")]
        public string arrowDisplayName = "Carbon Broadhead";
        public ArrowCategory category = ArrowCategory.CarbonBroadhead;
        [TextArea(2, 4)]
        public string description = "Competition carbon shaft with a 3-blade broadhead.";
        public Color tipAccentColor = new Color(0.22f, 0.74f, 0.97f);
        public Color trailColor = new Color(0.22f, 0.74f, 0.97f, 0.65f);

        [Header("Ballistics & Flight Physics")]
        [Tooltip("Base kinetic damage at 100% draw tension.")]
        public float baseDamage = 100f;

        [Tooltip("Arrow Rigidbody mass in kg. Heavier warheads drop faster.")]
        [Range(0.2f, 3.0f)]
        public float mass = 1.0f;

        [Tooltip("Launch speed multiplier applied to bow maxLaunchSpeed.")]
        [Range(0.5f, 1.5f)]
        public float muzzleVelocityMultiplier = 1.0f;

        [Tooltip("Custom gravity scale applied in FixedUpdate.")]
        [Range(0.2f, 2.5f)]
        public float gravityMultiplier = 1.0f;

        [Tooltip("Quadratic aerodynamic drag coefficient.")]
        [Range(0.0005f, 0.05f)]
        public float dragCoefficient = 0.004f;

        [Tooltip("Multiplier applied to concentric target ring score.")]
        public float ringScoreMultiplier = 1.0f;

        [Header("Special Ability Payload")]
        [Tooltip("ThermiteDetonator: OverlapSphere radius in meters.")]
        public float explosionRadius = 5.5f;
        public float explosionForce = 650f;

        [Tooltip("CryoFrostShard: Target movement speed multiplier (0.12 = 88% slow) and duration.")]
        [Range(0.0f, 1.0f)]
        public float cryoTimeScale = 0.12f;
        public float cryoFreezeDuration = 6.0f;

        [Tooltip("VoltArcSeeker: Maximum chain lightning jumps and search radius.")]
        public int maxChainTargets = 2;
        public float chainSearchRadius = 10.5f;
        public float chainDamageFalloff = 0.7f;

        [Tooltip("ChronoSplitVolley: Flight time before bifurcating into 3 arrows and spread angle.")]
        public float splitFlightDelay = 0.16f;
        public float splitSpreadAngleDeg = 3.6f;

        [Header("Visual & Audio Prefabs")]
        public Mesh customTipMesh;
        public Material tipMaterial;
        public GameObject impactVfxPrefab;
        public AudioClip launchSound;
        public AudioClip impactSound;

        [Header("Meta Quest Haptics")]
        [Range(0.1f, 1.0f)]
        public float releaseHapticAmplitude = 0.75f;
        [Range(0.02f, 0.25f)]
        public float releaseHapticDuration = 0.08f;
    }
}`,
  },
  {
    id: 'vr-quiver-inventory',
    fileName: 'VRArrowQuiverInventory.cs',
    className: 'VRArrowQuiverInventory : MonoBehaviour',
    roleSummary:
      'Manages the player’s selectable arrow loadout on Meta Quest via Thumbstick radial cycling, wrist HUD buttons, or over-the-shoulder quiver grab.',
    keyHighlights: [
      'Allows seamless switching between all 5 ArrowTypeData presets using Quest Primary/Secondary Thumbstick or wrist UI',
      'Hot-swaps the currently nocked arrow’s ArrowTypeData and tip mesh/material even while already nocked on the bowstring',
      'Broadcasts OnArrowTypeSelected event so the Bow trajectory preview and Wrist HUD stay synchronized',
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    [Serializable]
    public class ArrowTypeChangedEvent : UnityEvent<ArrowTypeData> { }

    /// <summary>
    /// Handles arrow type selection via Meta Quest thumbstick flick, wrist UI,
    /// and over-the-shoulder quiver spawning.
    /// </summary>
    public class VRArrowQuiverInventory : MonoBehaviour
    {
        [Header("Arrow Archetype Loadout")]
        [SerializeField] private List<ArrowTypeData> availableArrowTypes = new List<ArrowTypeData>();
        [SerializeField] private int currentIndex = 0;

        [Header("References")]
        [SerializeField] private VRBowController bowController;
        [SerializeField] private VRArrowProjectile arrowPrefab;
        [SerializeField] private Transform quiverShoulderSocket;

        [Header("Quest Input Configuration")]
        [SerializeField] private XRNode selectorHandNode = XRNode.RightHand;
        [SerializeField] private float thumbstickDeadzone = 0.65f;
        [SerializeField] private float cycleCooldown = 0.28f;

        public ArrowTypeChangedEvent onArrowTypeChanged = new ArrowTypeChangedEvent();

        private float _lastCycleTime;
        private bool _stickNeutral = true;

        public ArrowTypeData ActiveArrowType =>
            (availableArrowTypes != null && availableArrowTypes.Count > 0)
                ? availableArrowTypes[Mathf.Clamp(currentIndex, 0, availableArrowTypes.Count - 1)]
                : null;

        private void Start()
        {
            if (ActiveArrowType != null)
            {
                NotifySelectionChanged();
            }
        }

        private void Update()
        {
            PollThumbstickSelection();
        }

        private void PollThumbstickSelection()
        {
            if (availableArrowTypes.Count <= 1) return;

            InputDevice device = InputDevices.GetDeviceAtXRNode(selectorHandNode);
            if (!device.isValid) return;

            if (device.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 axis))
            {
                if (Mathf.Abs(axis.x) < 0.25f)
                {
                    _stickNeutral = true;
                }
                else if (_stickNeutral && Time.time - _lastCycleTime >= cycleCooldown)
                {
                    _stickNeutral = false;
                    _lastCycleTime = Time.time;

                    int delta = axis.x > thumbstickDeadzone ? 1 : (axis.x < -thumbstickDeadzone ? -1 : 0);
                    if (delta != 0)
                    {
                        SelectArrowByIndex((currentIndex + delta + availableArrowTypes.Count) % availableArrowTypes.Count);
                        TriggerSelectionHaptic(device);
                    }
                }
            }
        }

        /// <summary>
        /// Can be invoked directly from Meta Quest Poke/Ray Wrist UI buttons or radial menu.
        /// </summary>
        public void SelectArrowByIndex(int index)
        {
            if (availableArrowTypes == null || availableArrowTypes.Count == 0) return;

            currentIndex = Mathf.Clamp(index, 0, availableArrowTypes.Count - 1);
            NotifySelectionChanged();
        }

        public void SelectArrowByCategory(ArrowCategory category)
        {
            int idx = availableArrowTypes.FindIndex(a => a.category == category);
            if (idx >= 0) SelectArrowByIndex(idx);
        }

        private void NotifySelectionChanged()
        {
            ArrowTypeData active = ActiveArrowType;
            if (active == null) return;

            // If an arrow is currently nocked on the bowstring, hot-swap its payload live
            if (bowController != null)
            {
                bowController.ApplyArrowTypeToNockedArrow(active);
            }

            onArrowTypeChanged?.Invoke(active);
        }

        /// <summary>
        /// Spawns a configured arrow instance when the player grabs from the shoulder quiver.
        /// Triggers an out-of-ammo haptic alert if the selected arrow type is depleted.
        /// </summary>
        public VRArrowProjectile SpawnConfiguredArrow(Vector3 position, Quaternion rotation)
        {
            ArrowTypeData active = ActiveArrowType;
            if (active != null && QuiverManager.Instance != null)
            {
                if (!QuiverManager.Instance.CanNockOrTriggerAlert(active.category, selectorHandNode))
                {
                    return null;
                }
            }

            VRArrowProjectile instance = Instantiate(arrowPrefab, position, rotation);
            instance.ConfigureArrowType(active);
            return instance;
        }

        private void TriggerSelectionHaptic(InputDevice device)
        {
            if (device.TryGetHapticCapabilities(out HapticCapabilities caps) && caps.supportsImpulse)
            {
                device.SendHapticImpulse(0u, 0.35f, 0.03f);
            }
        }
    }
}`,
  },
  {
    id: 'vr-bow-controller',
    fileName: 'VRBowController.cs',
    className: 'VRBowController : MonoBehaviour',
    roleSummary:
      'Handles two-handed Meta Quest bow grip, magnetic nock socket detection, draw tension math, dynamic limb flex, mass-calibrated trajectory preview, and Chrono-Split spawning.',
    keyHighlights: [
      'Projects drawing hand controller into bow local space to compute exact drawDistance and normalized drawTension (0..1)',
      'Dynamically updates 2-segment LineRenderer bowstring, limb Animator flex weight, and continuous Quest controller haptics proportional to draw tension',
      'Renders a ballistic LineRenderer arc that automatically adjusts to the active ArrowTypeData mass, muzzle velocity, and gravityMultiplier',
    ],
    code: `using System.Collections;
using UnityEngine;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    /// <summary>
    /// Core VR Bow mechanics for Meta Quest: handles string pulling, arrow nocking,
    /// limb bending, haptic tension feedback, and multi-arrow launch physics.
    /// </summary>
    public class VRBowController : MonoBehaviour
    {
        [Header("Bow Transforms & String")]
        [SerializeField] private Transform bowGripTransform;
        [SerializeField] private Transform nockRestPivot;
        [SerializeField] private Transform upperLimbTip;
        [SerializeField] private Transform lowerLimbTip;
        [SerializeField] private LineRenderer bowStringRenderer;
        [SerializeField] private LineRenderer trajectoryLineRenderer;

        [Header("Draw & Launch Settings")]
        [SerializeField] private float minDrawDistance = 0.08f;
        [SerializeField] private float maxDrawDistance = 0.68f;
        [SerializeField] private float baseMaxLaunchSpeed = 58f;
        [SerializeField] private float stringReturnSpeed = 42f;
        [SerializeField] private float nockSnapRadius = 0.14f;

        [Header("Animations & Audio")]
        [SerializeField] private Animator bowLimbAnimator;
        [SerializeField] private AudioSource bowAudioSource;
        [SerializeField] private AudioClip drawCreakClip;

        private VRArrowProjectile _nockedArrow;
        private Transform _pullingHandTransform;
        private XRNode _pullingHandNode = XRNode.RightHand;
        private XRNode _bowHandNode = XRNode.LeftHand;

        private float _currentDrawDistance;
        private float _lastHapticPulseDistance;
        private bool _isPullingString;

        public float NormalizedTension =>
            Mathf.InverseLerp(minDrawDistance, maxDrawDistance, _currentDrawDistance);

        public VRArrowProjectile NockedArrow => _nockedArrow;

        private void Update()
        {
            if (_isPullingString && _pullingHandTransform != null)
            {
                UpdateStringPull();
                UpdateTrajectoryPreview();
            }
            else
            {
                // Snap string smoothly back to brace height
                _currentDrawDistance = Mathf.MoveTowards(_currentDrawDistance, 0f, stringReturnSpeed * Time.deltaTime);
                if (trajectoryLineRenderer != null) trajectoryLineRenderer.enabled = false;
            }

            UpdateBowVisuals();
        }

        /// <summary>
        /// Called when player's arrow enters the bow's nock socket collider or grab trigger is pressed.
        /// </summary>
        public bool TryNockArrow(VRArrowProjectile candidateArrow, Transform pullingHand, XRNode handNode = XRNode.RightHand)
        {
            if (_nockedArrow != null || candidateArrow == null) return false;

            float distToNock = Vector3.Distance(candidateArrow.NockPoint.position, nockRestPivot.position);
            if (distToNock > nockSnapRadius) return false;

            if (candidateArrow.ArrowData != null && QuiverManager.Instance != null)
            {
                if (!QuiverManager.Instance.CanNockOrTriggerAlert(candidateArrow.ArrowData.category, handNode))
                {
                    return false;
                }
            }

            _nockedArrow = candidateArrow;
            _pullingHandTransform = pullingHand;
            _pullingHandNode = handNode;
            _isPullingString = true;

            _nockedArrow.OnNockedToBow(nockRestPivot);
            SendQuestHaptic(_pullingHandNode, 0.55f, 0.04f);
            SendQuestHaptic(_bowHandNode, 0.35f, 0.04f);

            if (bowAudioSource && drawCreakClip)
            {
                bowAudioSource.clip = drawCreakClip;
                bowAudioSource.Play();
            }

            return true;
        }

        public void ApplyArrowTypeToNockedArrow(ArrowTypeData newType)
        {
            if (_nockedArrow != null && newType != null)
            {
                _nockedArrow.ConfigureArrowType(newType);
            }
        }

        private void UpdateStringPull()
        {
            // Convert pulling hand world position into bow rest local space (-Z is pull back)
            Vector3 localHandPos = nockRestPivot.InverseTransformPoint(_pullingHandTransform.position);
            float rawPullBack = Mathf.Max(0f, -localHandPos.z);
            _currentDrawDistance = Mathf.Clamp(rawPullBack, 0f, maxDrawDistance);

            // Position nocked arrow along draw axis
            if (_nockedArrow != null)
            {
                _nockedArrow.transform.localPosition = new Vector3(0f, 0f, -_currentDrawDistance);
                _nockedArrow.transform.localRotation = Quaternion.identity;
            }

            // Ratchet haptic clicks every 2.5cm of draw for tactile Quest realism
            if (Mathf.Abs(_currentDrawDistance - _lastHapticPulseDistance) >= 0.025f)
            {
                _lastHapticPulseDistance = _currentDrawDistance;
                float tension = NormalizedTension;
                SendQuestHaptic(_pullingHandNode, 0.15f + tension * 0.55f, 0.02f);
                SendQuestHaptic(_bowHandNode, 0.1f + tension * 0.3f, 0.02f);
            }
        }

        /// <summary>
        /// Invoked when the player releases the index trigger on the string hand.
        /// </summary>
        public void ReleaseString()
        {
            if (!_isPullingString) return;
            _isPullingString = false;

            float tension = NormalizedTension;

            if (_nockedArrow != null)
            {
                if (tension >= 0.12f)
                {
                    FireNockedArrow(tension);
                }
                else
                {
                    // Insufficient draw: keep arrow nocked at rest
                    _nockedArrow.transform.localPosition = Vector3.zero;
                }
            }

            _pullingHandTransform = null;
        }

        private void FireNockedArrow(float tension)
        {
            VRArrowProjectile firedArrow = _nockedArrow;
            _nockedArrow = null;

            ArrowTypeData arrowData = firedArrow.ArrowData;
            if (arrowData != null)
            {
                QuiverManager.Instance?.ConsumeArrow(arrowData.category);
            }

            float speedMultiplier = arrowData != null ? arrowData.muzzleVelocityMultiplier : 1f;
            float massFactor = arrowData != null ? Mathf.Sqrt(1f / Mathf.Max(0.25f, arrowData.mass)) : 1f;

            float launchSpeed = baseMaxLaunchSpeed * speedMultiplier * massFactor * Mathf.Lerp(0.18f, 1.0f, tension);
            Vector3 launchVelocity = nockRestPivot.forward * launchSpeed;

            firedArrow.Launch(launchVelocity, tension);

            // Handle Chrono-Split Volley mid-air bifurcation
            if (arrowData != null && arrowData.category == ArrowCategory.ChronoSplitVolley)
            {
                StartCoroutine(SpawnChronoSplitVolleyRoutine(firedArrow, tension, arrowData));
            }

            // Release haptics scaled by arrow type
            float hapAmp = arrowData != null ? arrowData.releaseHapticAmplitude : 0.75f;
            float hapDur = arrowData != null ? arrowData.releaseHapticDuration : 0.08f;
            SendQuestHaptic(_pullingHandNode, hapAmp, hapDur);
            SendQuestHaptic(_bowHandNode, hapAmp * 0.85f, hapDur);
        }

        private IEnumerator SpawnChronoSplitVolleyRoutine(VRArrowProjectile primaryArrow, float tension, ArrowTypeData data)
        {
            yield return new WaitForSeconds(data.splitFlightDelay);

            if (primaryArrow == null || primaryArrow.HasImpacted) yield break;

            Vector3 splitOrigin = primaryArrow.transform.position;
            Vector3 currentVel = primaryArrow.CurrentVelocity;
            float[] angles = new float[] { -data.splitSpreadAngleDeg, data.splitSpreadAngleDeg };

            foreach (float angle in angles)
            {
                Quaternion spreadRot = Quaternion.AngleAxis(angle, Vector3.up);
                Vector3 branchVel = spreadRot * currentVel;

                VRArrowProjectile clone = Instantiate(primaryArrow, splitOrigin, Quaternion.LookRotation(branchVel));
                clone.ConfigureArrowType(data);
                clone.Launch(branchVel, tension);
            }
        }

        private void UpdateBowVisuals()
        {
            Vector3 stringNockWorld = nockRestPivot.TransformPoint(new Vector3(0f, 0f, -_currentDrawDistance));

            if (bowStringRenderer != null && upperLimbTip != null && lowerLimbTip != null)
            {
                bowStringRenderer.positionCount = 3;
                bowStringRenderer.SetPosition(0, upperLimbTip.position);
                bowStringRenderer.SetPosition(1, stringNockWorld);
                bowStringRenderer.SetPosition(2, lowerLimbTip.position);
            }

            if (bowLimbAnimator != null)
            {
                bowLimbAnimator.SetFloat("DrawTension", NormalizedTension);
            }
        }

        private void UpdateTrajectoryPreview()
        {
            if (trajectoryLineRenderer == null || _nockedArrow == null) return;

            float tension = NormalizedTension;
            if (tension < 0.15f)
            {
                trajectoryLineRenderer.enabled = false;
                return;
            }

            trajectoryLineRenderer.enabled = true;
            ArrowTypeData data = _nockedArrow.ArrowData;
            float speedMult = data != null ? data.muzzleVelocityMultiplier : 1f;
            float massFactor = data != null ? Mathf.Sqrt(1f / Mathf.Max(0.25f, data.mass)) : 1f;
            float gravMult = data != null ? data.gravityMultiplier : 1f;

            float speed = baseMaxLaunchSpeed * speedMult * massFactor * Mathf.Lerp(0.18f, 1.0f, tension);
            Vector3 pos = nockRestPivot.position;
            Vector3 vel = nockRestPivot.forward * speed;
            Vector3 gravity = Physics.gravity * gravMult;

            int steps = 28;
            float dt = 0.045f;
            trajectoryLineRenderer.positionCount = steps;

            for (int i = 0; i < steps; i++)
            {
                trajectoryLineRenderer.SetPosition(i, pos);
                vel += gravity * dt;
                pos += vel * dt;
            }
        }

        private void SendQuestHaptic(XRNode node, float amplitude, float duration)
        {
            InputDevice dev = InputDevices.GetDeviceAtXRNode(node);
            if (dev.isValid && dev.TryGetHapticCapabilities(out HapticCapabilities caps) && caps.supportsImpulse)
            {
                dev.SendHapticImpulse(0u, Mathf.Clamp01(amplitude), duration);
            }
        }
    }
}`,
  },
  {
    id: 'vr-arrow-projectile',
    fileName: 'VRArrowProjectile.cs',
    className: 'VRArrowProjectile : MonoBehaviour',
    roleSummary:
      'Handles arrow flight aerodynamics, continuous raycast anti-tunneling collision detection, ring accuracy evaluation, and polymorphic special ability execution.',
    keyHighlights: [
      'Aligns arrow shaft to velocity vector in FixedUpdate while applying ArrowTypeData gravityMultiplier and quadratic drag',
      'Performs continuous Physics.Raycast from previous Tip position to current Tip position so high-speed arrows never tunnel through thin targets',
      'Executes specialized impact payloads: OverlapSphere Thermite blast, Cryo target time-dilation freeze, and multi-target Volt Chain Lightning',
    ],
    code: `using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    public interface IArrowHittable
    {
        Transform TargetTransform { get; }
        void OnArrowImpact(VRArrowProjectile arrow, RaycastHit hit, float damage, float scoreMultiplier);
        void ApplyCryoFreeze(float speedMultiplier, float duration);
    }

    /// <summary>
    /// Physics-driven VR Arrow handling aerodynamic flight, anti-tunneling raycast collision,
    /// target embedding, and special arrow impact abilities.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class VRArrowProjectile : MonoBehaviour
    {
        [Header("Arrow Anatomy")]
        [SerializeField] private Transform tipTransform;
        [SerializeField] private Transform nockTransform;
        [SerializeField] private MeshFilter tipMeshFilter;
        [SerializeField] private MeshRenderer tipMeshRenderer;
        [SerializeField] private TrailRenderer flightTrail;

        [Header("Collision Settings")]
        [SerializeField] private LayerMask hitLayerMask = ~0;
        [SerializeField] private float embedPenetrationDepth = 0.09f;
        [SerializeField] private float maxFlightLifetime = 12f;

        private Rigidbody _rb;
        private ArrowTypeData _arrowData;
        private Vector3 _previousTipPosition;
        private Vector3 _launchOrigin;
        private float _flightTime;
        private float _drawTensionAtLaunch = 1f;
        private bool _inFlight;
        private bool _hasImpacted;

        public ArrowTypeData ArrowData => _arrowData;
        public Transform NockPoint => nockTransform;
        public bool HasImpacted => _hasImpacted;
        public Vector3 CurrentVelocity => _rb != null ? _rb.linearVelocity : Vector3.zero;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody>();
            _rb.useGravity = false; // Custom gravity scale handled in FixedUpdate
        }

        public void ConfigureArrowType(ArrowTypeData data)
        {
            _arrowData = data;
            if (data == null) return;

            _rb.mass = data.mass;
            if (tipMeshFilter != null && data.customTipMesh != null)
                tipMeshFilter.sharedMesh = data.customTipMesh;

            if (tipMeshRenderer != null && data.tipMaterial != null)
                tipMeshRenderer.sharedMaterial = data.tipMaterial;

            if (flightTrail != null)
                flightTrail.startColor = data.trailColor;
        }

        public void OnNockedToBow(Transform nockSocket)
        {
            _inFlight = false;
            _hasImpacted = false;
            _rb.isKinematic = true;
            transform.SetParent(nockSocket, false);
            transform.localPosition = Vector3.zero;
            transform.localRotation = Quaternion.identity;
        }

        public void Launch(Vector3 initialVelocity, float drawTension)
        {
            transform.SetParent(null, true);
            _launchOrigin = transform.position;
            _flightTime = 0f;
            _drawTensionAtLaunch = drawTension;
            _inFlight = true;
            _hasImpacted = false;

            _rb.isKinematic = false;
            _rb.linearVelocity = initialVelocity;
            _previousTipPosition = tipTransform.position;

            if (flightTrail != null) flightTrail.emitting = true;
            if (_arrowData != null)
            {
                Transform tailAnchor = nockTransform != null ? nockTransform : transform;
                ProjectileTrailManager.Instance?.AttachTrailToArrow(tailAnchor, _arrowData.category);
            }
            Destroy(gameObject, maxFlightLifetime);
        }

        private void FixedUpdate()
        {
            if (!_inFlight || _hasImpacted) return;

            _flightTime += Time.fixedDeltaTime;

            // 1. Apply custom gravity multiplier, quadratic drag & flight-time-scaled wind force
            float gravMult = _arrowData != null ? _arrowData.gravityMultiplier : 1f;
            float dragCoeff = _arrowData != null ? _arrowData.dragCoefficient : 0.004f;

            Vector3 v = _rb.linearVelocity;
            v += Physics.gravity * (gravMult * Time.fixedDeltaTime);
            v *= Mathf.Max(0f, 1f - dragCoeff * v.magnitude * Time.fixedDeltaTime);
            _rb.linearVelocity = v;

            WindEffectController.Instance?.ApplyFlightWindForce(_rb, _flightTime, _drawTensionAtLaunch);

            // 2. Aerodynamic fletching torque: align shaft along velocity vector
            if (v.sqrMagnitude > 0.5f)
            {
                Quaternion targetRot = Quaternion.LookRotation(v.normalized, Vector3.up);
                _rb.MoveRotation(Quaternion.Slerp(_rb.rotation, targetRot, 18f * Time.fixedDeltaTime));
            }

            // 3. Continuous Raycast between previous and current tip position to prevent tunneling
            Vector3 currentTipPos = tipTransform.position;
            Vector3 stepDelta = currentTipPos - _previousTipPosition;
            float stepDist = stepDelta.magnitude;

            if (stepDist > 0.0001f)
            {
                if (Physics.Raycast(_previousTipPosition, stepDelta.normalized, out RaycastHit hit, stepDist + 0.04f, hitLayerMask, QueryTriggerInteraction.Ignore))
                {
                    HandleImpact(hit);
                    return;
                }
            }

            _previousTipPosition = currentTipPos;
        }

        private void HandleImpact(RaycastHit hit)
        {
            Vector3 impactVelocity = _rb.linearVelocity;
            float speed = impactVelocity.magnitude;
            Vector3 shaftDir = speed > 0.01f ? impactVelocity / speed : transform.forward;
            float arrowMass = _arrowData != null ? _arrowData.mass : _rb.mass;

            // Evaluate material-based penetration depth (pierce thin wood vs stick/ricochet stone & iron)
            PenetrationOutcome pen = ArrowPenetration.EvaluateStaticOrInstance(
                hit,
                impactVelocity,
                arrowMass,
                _drawTensionAtLaunch
            );

            float baseDmg = (_arrowData != null ? _arrowData.baseDamage : 100f) * _drawTensionAtLaunch;
            float hitDistance = Vector3.Distance(_launchOrigin, hit.point);
            float nominalMuzzle = _arrowData != null ? _arrowData.muzzleVelocity : 62f;
            float closeForceMult = WindEffectController.Instance != null
                ? WindEffectController.Instance.EvaluateProximityForceMultiplier(hitDistance, speed, nominalMuzzle, _drawTensionAtLaunch)
                : 1f;
            float scoreMult = _arrowData != null ? _arrowData.ringScoreMultiplier : 1f;

            IArrowHittable primaryTarget = hit.collider.GetComponentInParent<IArrowHittable>();
            if (primaryTarget != null)
            {
                primaryTarget.OnArrowImpact(this, hit, baseDmg * pen.damageRetention * closeForceMult, scoreMult);
            }

            // Trigger Meta Quest OVRInput material-specific controller haptics & impact particles
            VibrationController.Instance?.TriggerImpactFromCollider(hit.collider, _drawTensionAtLaunch);
            ImpactParticleManager.Instance?.SpawnImpactFromRaycastHit(hit);

            // Execute special arrow payload
            ExecuteSpecialImpactAbility(hit, primaryTarget, baseDmg);

            if (pen.outcomeType == PenetrationOutcomeType.PassedThrough)
            {
                // Punch through thin wooden shields/barricades and continue flying toward enemy behind!
                Vector3 tipOffset = tipTransform.position - transform.position;
                Vector3 safeExitTip = pen.exitPoint + shaftDir * 0.06f;
                transform.position = safeExitTip - tipOffset;
                _previousTipPosition = safeExitTip;
                _rb.linearVelocity = pen.residualVelocity;
                _drawTensionAtLaunch *= pen.damageRetention;
                return;
            }

            _hasImpacted = true;
            _inFlight = false;

            Transform impactTailAnchor = nockTransform != null ? nockTransform : transform;
            ProjectileTrailManager.Instance?.ReleaseTrailOnImpact(impactTailAnchor);

            if (pen.outcomeType == PenetrationOutcomeType.Ricochet)
            {
                // Deflect off angled stone or iron plate instead of sticking unrealistically
                _rb.isKinematic = false;
                _rb.useGravity = true;
                _rb.linearVelocity = pen.residualVelocity;
                _rb.angularVelocity = Random.insideUnitSphere * 14f;
                return;
            }

            _rb.linearVelocity = Vector3.zero;
            _rb.angularVelocity = Vector3.zero;
            _rb.isKinematic = true;

            // Embed arrow tip to calculated material penetration depth (deeper in Wood, shallow in Stone/Iron)
            float embedDepth = pen.embedDepthMeters > 0f ? pen.embedDepthMeters : embedPenetrationDepth;
            Vector3 finalTipOffset = tipTransform.position - transform.position;
            transform.position = hit.point - finalTipOffset + shaftDir * embedDepth;

            // Parent to hit collider so arrow moves with patrolling/wobbling targets
            transform.SetParent(hit.collider.transform, true);
        }

        private void ExecuteSpecialImpactAbility(RaycastHit hit, IArrowHittable directTarget, float damage)
        {
            if (_arrowData == null) return;

            switch (_arrowData.category)
            {
                case ArrowCategory.ThermiteDetonator:
                    ExecuteThermiteExplosion(hit.point, damage);
                    break;

                case ArrowCategory.CryoFrostShard:
                    if (directTarget != null)
                    {
                        directTarget.ApplyCryoFreeze(_arrowData.cryoTimeScale, _arrowData.cryoFreezeDuration);
                    }
                    break;

                case ArrowCategory.VoltArcSeeker:
                    ExecuteVoltChainLightning(hit.point, directTarget, damage);
                    break;
            }
        }

        private void ExecuteThermiteExplosion(Vector3 blastOrigin, float baseDamage)
        {
            Collider[] colliders = Physics.OverlapSphere(blastOrigin, _arrowData.explosionRadius, hitLayerMask);
            HashSet<IArrowHittable> affectedTargets = new HashSet<IArrowHittable>();

            foreach (Collider col in colliders)
            {
                IArrowHittable target = col.GetComponentInParent<IArrowHittable>();
                if (target != null && !affectedTargets.Contains(target))
                {
                    affectedTargets.Add(target);
                    float dist = Vector3.Distance(blastOrigin, target.TargetTransform.position);
                    float falloff = Mathf.Clamp01(1f - (dist / _arrowData.explosionRadius));

                    RaycastHit syntheticHit = new RaycastHit { point = target.TargetTransform.position };
                    target.OnArrowImpact(this, syntheticHit, baseDamage * falloff, _arrowData.ringScoreMultiplier);
                }

                if (col.attachedRigidbody != null && !col.attachedRigidbody.isKinematic)
                {
                    col.attachedRigidbody.AddExplosionForce(_arrowData.explosionForce, blastOrigin, _arrowData.explosionRadius, 0.5f, ForceMode.Impulse);
                }
            }
        }

        private void ExecuteVoltChainLightning(Vector3 origin, IArrowHittable primaryTarget, float initialDamage)
        {
            Collider[] candidates = Physics.OverlapSphere(origin, _arrowData.chainSearchRadius, hitLayerMask);
            HashSet<IArrowHittable> visited = new HashSet<IArrowHittable>();
            if (primaryTarget != null) visited.Add(primaryTarget);

            int jumps = 0;
            float currentDamage = initialDamage * _arrowData.chainDamageFalloff;

            foreach (Collider col in candidates)
            {
                if (jumps >= _arrowData.maxChainTargets) break;

                IArrowHittable nextTarget = col.GetComponentInParent<IArrowHittable>();
                if (nextTarget != null && !visited.Contains(nextTarget))
                {
                    visited.Add(nextTarget);
                    jumps++;

                    RaycastHit arcHit = new RaycastHit { point = nextTarget.TargetTransform.position };
                    nextTarget.OnArrowImpact(this, arcHit, currentDamage, _arrowData.ringScoreMultiplier);
                    currentDamage *= _arrowData.chainDamageFalloff;
                }
            }
        }
    }
}`,
  },
  {
    id: 'vr-player-rig-calibration',
    fileName: 'VRPlayerRigCalibration.cs',
    className: 'VRPlayerRigCalibration : MonoBehaviour',
    roleSummary:
      'Applies user-calibrated virtual interpupillary distance (IPD), dominant-eye bow sight alignment, and controller-to-string hand offsets to the Meta Quest XR player rig.',
    keyHighlights: [
      'Adjusts stereoSeparation and Left/Right eye anchor local X transforms from calibrated IPD (54mm–74mm)',
      'Aligns bow grip pivot laterally with the player’s dominant aiming eye for accurate holographic sight convergence',
      'Offsets calibratedStringHandAnchor relative to the physical Quest controller so nocked draws avoid headset/controller ring collisions',
    ],
    code: generateCalibrationCSharpSnippet(DEFAULT_CALIBRATION_SETTINGS),
  },
  {
    id: 'vr-archery-spatial-audio',
    fileName: 'VRArcherySpatialAudio.cs',
    className: 'VRArcherySpatialAudio : MonoBehaviour',
    roleSummary:
      'Spatialized 3D audio controller for Meta Quest handling continuous bow draw tension creaks, release snaps, velocity-driven arrow flight whistles, and Wood/Stone/Metal impact cues.',
    keyHighlights: [
      'Configures 3D spatialBlend = 1.0f, Logarithmic rolloff, and Doppler scaling for authentic Meta Quest HRTF localization',
      'Drives a velocity-modulated looping whistle AudioSource attached to each airborne arrow Transform',
      'Resolves SurfaceMaterialType (Wood, Stone, Metal) from hit colliders to trigger material-specific impact variations',
    ],
    code: `using UnityEngine;

namespace MetaQuestArchery
{
    public enum SurfaceMaterialType
    {
        Wood = 0,
        Stone = 1,
        Metal = 2
    }

    /// <summary>
    /// Attach to target/environment GameObjects to declare their acoustic surface material.
    /// </summary>
    public class SurfaceMaterialTag : MonoBehaviour
    {
        public SurfaceMaterialType materialType = SurfaceMaterialType.Wood;
    }

    /// <summary>
    /// Triggers 3D spatialized audio events on Meta Quest for bow draw tension,
    /// string release, continuous aerodynamic arrow flight whistle, and material-specific impacts.
    /// </summary>
    public class VRArcherySpatialAudio : MonoBehaviour
    {
        [Header("Bow Draw & Release Audio")]
        [SerializeField] private AudioSource bowDrawLoopSource;
        [SerializeField] private AudioClip[] drawTickClips;
        [SerializeField] private AudioClip[] releaseTwangClips;
        [SerializeField] private AnimationCurve drawPitchCurve = AnimationCurve.Linear(0f, 0.8f, 1f, 1.45f);

        [Header("Arrow Flight Whistle")]
        [SerializeField] private AudioClip arrowWhistleLoopClip;
        [SerializeField] private float maxArrowSpeed = 68f;

        [Header("Material-Specific Impact Clips")]
        [SerializeField] private AudioClip[] woodImpactClips;
        [SerializeField] private AudioClip[] stoneImpactClips;
        [SerializeField] private AudioClip[] metalImpactClips;

        private float _lastTickTension;

        /// <summary>
        /// 1. Continuous + ratcheted spatialized bow draw tension feedback at bow position.
        /// </summary>
        public void UpdateDrawTensionAudio(float normalizedTension, Vector3 bowWorldPos)
        {
            if (bowDrawLoopSource == null) return;

            bowDrawLoopSource.transform.position = bowWorldPos;
            bowDrawLoopSource.spatialBlend = 1.0f;

            if (normalizedTension > 0.04f)
            {
                if (!bowDrawLoopSource.isPlaying) bowDrawLoopSource.Play();
                bowDrawLoopSource.volume = Mathf.Lerp(0.05f, 0.65f, normalizedTension);
                bowDrawLoopSource.pitch = drawPitchCurve.Evaluate(normalizedTension);

                if (Mathf.Abs(normalizedTension - _lastTickTension) >= 0.12f && drawTickClips.Length > 0)
                {
                    _lastTickTension = normalizedTension;
                    AudioClip tick = drawTickClips[Random.Range(0, drawTickClips.Length)];
                    bowDrawLoopSource.PlayOneShot(tick, 0.35f + normalizedTension * 0.4f);
                }
            }
            else if (bowDrawLoopSource.isPlaying)
            {
                bowDrawLoopSource.Stop();
                _lastTickTension = 0f;
            }
        }

        /// <summary>
        /// 2. Spatialized bowstring release twang + limb snap at nock origin.
        /// </summary>
        public void PlayReleaseAudio(Vector3 releasePos, float normalizedTension)
        {
            if (bowDrawLoopSource != null && bowDrawLoopSource.isPlaying)
            {
                bowDrawLoopSource.Stop();
            }

            if (releaseTwangClips == null || releaseTwangClips.Length == 0) return;

            AudioClip clip = releaseTwangClips[Random.Range(0, releaseTwangClips.Length)];
            SpawnOneShotSpatialSource("BowRelease_Audio", releasePos, clip, Mathf.Lerp(0.4f, 1.0f, normalizedTension), Random.Range(0.95f, 1.08f));
        }

        /// <summary>
        /// 3. Attaches a spatialized Doppler-enabled flight whistle to a launched arrow.
        /// </summary>
        public AudioSource AttachArrowFlightWhistle(Transform arrowTransform)
        {
            if (arrowWhistleLoopClip == null || arrowTransform == null) return null;

            AudioSource whistle = arrowTransform.gameObject.AddComponent<AudioSource>();
            whistle.clip = arrowWhistleLoopClip;
            whistle.loop = true;
            whistle.spatialBlend = 1.0f;
            whistle.rolloffMode = AudioRolloffMode.Logarithmic;
            whistle.minDistance = 1.5f;
            whistle.maxDistance = 85f;
            whistle.dopplerLevel = 1.4f;
            whistle.volume = 0f;
            whistle.Play();
            return whistle;
        }

        /// <summary>
        /// Modulates flight whistle pitch & gain every physics step based on arrow velocity.
        /// </summary>
        public void UpdateArrowFlightWhistle(AudioSource whistle, float currentSpeed)
        {
            if (whistle == null || !whistle.isPlaying) return;

            float speedRatio = Mathf.Clamp01(currentSpeed / maxArrowSpeed);
            whistle.volume = Mathf.Lerp(0.02f, 0.55f, speedRatio);
            whistle.pitch = Mathf.Lerp(0.68f, 1.55f, speedRatio);
        }

        /// <summary>
        /// 4. Resolves collider SurfaceMaterialTag and plays Wood, Stone, or Metal impact audio at hit point.
        /// </summary>
        public void PlayMaterialImpact(Collider hitCollider, Vector3 hitPoint, float impactSpeed)
        {
            SurfaceMaterialType surface = SurfaceMaterialType.Wood;
            if (hitCollider != null)
            {
                SurfaceMaterialTag tag = hitCollider.GetComponentInParent<SurfaceMaterialTag>();
                if (tag != null) surface = tag.materialType;
            }

            AudioClip[] bank = surface switch
            {
                SurfaceMaterialType.Metal => metalImpactClips,
                SurfaceMaterialType.Stone => stoneImpactClips,
                _ => woodImpactClips
            };

            if (bank == null || bank.Length == 0) return;

            AudioClip clip = bank[Random.Range(0, bank.Length)];
            float vol = Mathf.Clamp(impactSpeed / maxArrowSpeed, 0.35f, 1.0f);
            float pitchJitter = surface == SurfaceMaterialType.Metal ? Random.Range(0.96f, 1.04f) : Random.Range(0.9f, 1.12f);

            SpawnOneShotSpatialSource($"Impact_{surface}_Audio", hitPoint, clip, vol, pitchJitter);
        }

        private void SpawnOneShotSpatialSource(string objName, Vector3 worldPos, AudioClip clip, float volume, float pitch)
        {
            GameObject go = new GameObject(objName);
            go.transform.position = worldPos;
            AudioSource src = go.AddComponent<AudioSource>();
            src.clip = clip;
            src.spatialBlend = 1.0f;
            src.rolloffMode = AudioRolloffMode.Logarithmic;
            src.minDistance = 2.0f;
            src.maxDistance = 95f;
            src.volume = volume;
            src.pitch = pitch;
            src.Play();
            Destroy(go, clip.length / Mathf.Max(0.25f, pitch) + 0.1f);
        }
    }
}`,
  },
  {
    id: 'trajectory-preview-generator',
    fileName: 'TrajectoryPreviewGenerator.cs',
    className: 'TrajectoryPreviewGenerator : MonoBehaviour',
    roleSummary:
      'Helper component using a Unity LineRenderer to draw a real-time, drag- and wind-compensated ballistic arrow arc that updates dynamically as the player draws the bowstring.',
    keyHighlights: [
      'Matches VRArrowProjectile flight physics (gravityMultiplier, quadratic drag, mass-scaled muzzle velocity, and crosswind) with zero-GC pre-allocated Vector3 buffers',
      'Performs segment-by-segment Physics.Raycast checks along the simulated curve to truncate the arc cleanly at target surfaces and orient an optional impact reticle',
      'Dynamically tints LineRenderer width & Gradient from draw tension (green -> amber -> red) and active ArrowTypeData accent color',
    ],
    code: `using UnityEngine;

namespace MetaQuestArchery
{
    /// <summary>
    /// Helper script that draws a real-time predicted arrow trajectory using a LineRenderer,
    /// adjusting dynamically as the player pulls back the bowstring and switches arrow types.
    /// </summary>
    [RequireComponent(typeof(LineRenderer))]
    public class TrajectoryPreviewGenerator : MonoBehaviour
    {
        [Header("Bow & Aiming References")]
        [SerializeField] private VRBowController bowController;
        [SerializeField] private Transform launchOrigin;
        [SerializeField] private float baseMaxLaunchSpeed = 58f;
        [SerializeField] private float minLaunchSpeedRatio = 0.18f;

        [Header("Simulation Sampling")]
        [Range(10, 80)]
        [SerializeField] private int maxSamplePoints = 36;
        [Range(0.01f, 0.1f)]
        [SerializeField] private float simulationTimeStep = 0.04f;
        [Range(0.05f, 0.3f)]
        [SerializeField] private float minVisibleTension = 0.14f;

        [Header("Collision Truncation & Reticle")]
        [SerializeField] private LayerMask collisionMask = ~0;
        [SerializeField] private Transform impactReticleMarker;
        [SerializeField] private float reticleSurfaceOffset = 0.015f;

        [Header("Environment")]
        [SerializeField] private Vector3 windVelocity = Vector3.zero;
        [SerializeField] private float windInfluence = 0.35f;

        [Header("Visual Tension Styling")]
        [SerializeField] private bool tintByDrawStrength = true;
        [SerializeField] private Color lowTensionColor = new Color(0.22f, 0.90f, 0.45f, 0.90f);
        [SerializeField] private Color midTensionColor = new Color(0.98f, 0.75f, 0.14f, 0.95f);
        [SerializeField] private Color maxTensionColor = new Color(0.96f, 0.25f, 0.25f, 1.0f);

        private LineRenderer _lineRenderer;
        private Vector3[] _pointsBuffer;
        private Gradient _arcGradient;
        private GradientColorKey[] _colorKeys;
        private GradientAlphaKey[] _alphaKeys;

        private void Awake()
        {
            _lineRenderer = GetComponent<LineRenderer>();
            _lineRenderer.useWorldSpace = true;
            _lineRenderer.enabled = false;

            _pointsBuffer = new Vector3[maxSamplePoints];
            _arcGradient = new Gradient();
            _colorKeys = new GradientColorKey[2];
            _alphaKeys = new GradientAlphaKey[2];

            if (impactReticleMarker != null)
            {
                impactReticleMarker.gameObject.SetActive(false);
            }
        }

        private void LateUpdate()
        {
            if (bowController == null) return;

            VRArrowProjectile nocked = bowController.NockedArrow;
            Transform origin = launchOrigin != null ? launchOrigin : transform;

            if (nocked == null || bowController.NormalizedTension < minVisibleTension)
            {
                ClearPreview();
                return;
            }

            UpdatePreview(
                origin.position,
                origin.forward,
                bowController.NormalizedTension,
                nocked.ArrowData,
                baseMaxLaunchSpeed
            );
        }

        /// <summary>
        /// Computes and renders the predicted ballistic arc from current draw tension and arrow payload.
        /// Can also be driven directly from VRBowController or custom input scripts.
        /// </summary>
        public void UpdatePreview(
            Vector3 startPosition,
            Vector3 aimDirection,
            float normalizedTension,
            ArrowTypeData arrowData,
            float maxLaunchSpeed
        )
        {
            float clampedTension = Mathf.Clamp01(normalizedTension);
            if (clampedTension < minVisibleTension)
            {
                ClearPreview();
                return;
            }

            if (_pointsBuffer == null || _pointsBuffer.Length != maxSamplePoints)
            {
                _pointsBuffer = new Vector3[maxSamplePoints];
            }

            float speedMultiplier = arrowData != null ? arrowData.muzzleVelocityMultiplier : 1f;
            float mass = arrowData != null ? arrowData.mass : 1f;
            float massFactor = Mathf.Sqrt(1f / Mathf.Max(0.25f, mass));
            float gravityScale = arrowData != null ? arrowData.gravityMultiplier : 1f;
            float dragCoeff = arrowData != null ? arrowData.dragCoefficient : 0.004f;

            float launchSpeed = maxLaunchSpeed * speedMultiplier * massFactor * Mathf.Lerp(minLaunchSpeedRatio, 1f, clampedTension);

            Vector3 simPos = startPosition;
            Vector3 simVel = aimDirection.normalized * launchSpeed;
            Vector3 gravity = Physics.gravity * gravityScale;

            int validPointCount = 0;
            bool hitSurface = false;

            for (int i = 0; i < maxSamplePoints; i++)
            {
                _pointsBuffer[validPointCount++] = simPos;

                // Integrate forces to match VRArrowProjectile FixedUpdate physics
                Vector3 nextVel = simVel + gravity * simulationTimeStep;
                nextVel += windVelocity * windInfluence * simulationTimeStep;
                float dragFactor = Mathf.Max(0f, 1f - dragCoeff * nextVel.magnitude * simulationTimeStep);
                nextVel *= dragFactor;

                Vector3 displacement = nextVel * simulationTimeStep;
                float segmentLength = displacement.magnitude;

                if (segmentLength > 0.0001f &&
                    Physics.Raycast(simPos, displacement / segmentLength, out RaycastHit hit, segmentLength, collisionMask, QueryTriggerInteraction.Ignore))
                {
                    if (validPointCount < maxSamplePoints)
                    {
                        _pointsBuffer[validPointCount++] = hit.point;
                    }
                    else
                    {
                        _pointsBuffer[validPointCount - 1] = hit.point;
                    }

                    UpdateImpactReticle(true, hit.point, hit.normal);
                    hitSurface = true;
                    break;
                }

                simVel = nextVel;
                simPos += displacement;
            }

            if (!hitSurface)
            {
                UpdateImpactReticle(false, Vector3.zero, Vector3.up);
            }

            _lineRenderer.enabled = true;
            _lineRenderer.positionCount = validPointCount;
            _lineRenderer.SetPositions(_pointsBuffer);
            ApplyArcStyling(clampedTension, arrowData);
        }

        public void SetWindVelocity(Vector3 newWindVelocity)
        {
            windVelocity = newWindVelocity;
        }

        public void ClearPreview()
        {
            if (_lineRenderer != null && _lineRenderer.enabled)
            {
                _lineRenderer.enabled = false;
                _lineRenderer.positionCount = 0;
            }
            UpdateImpactReticle(false, Vector3.zero, Vector3.up);
        }

        private void UpdateImpactReticle(bool visible, Vector3 hitPoint, Vector3 hitNormal)
        {
            if (impactReticleMarker == null) return;

            impactReticleMarker.gameObject.SetActive(visible);
            if (visible)
            {
                impactReticleMarker.position = hitPoint + hitNormal * reticleSurfaceOffset;
                impactReticleMarker.rotation = Quaternion.LookRotation(hitNormal);
            }
        }

        private void ApplyArcStyling(float tension, ArrowTypeData arrowData)
        {
            Color baseColor;
            if (tintByDrawStrength)
            {
                baseColor = tension < 0.55f
                    ? Color.Lerp(lowTensionColor, midTensionColor, tension / 0.55f)
                    : Color.Lerp(midTensionColor, maxTensionColor, (tension - 0.55f) / 0.45f);
            }
            else
            {
                baseColor = arrowData != null ? arrowData.tipAccentColor : lowTensionColor;
            }

            _colorKeys[0] = new GradientColorKey(baseColor, 0f);
            _colorKeys[1] = new GradientColorKey(arrowData != null ? arrowData.tipAccentColor : baseColor, 1f);
            _alphaKeys[0] = new GradientAlphaKey(0.95f, 0f);
            _alphaKeys[1] = new GradientAlphaKey(0.12f, 1f);

            _arcGradient.SetKeys(_colorKeys, _alphaKeys);
            _lineRenderer.colorGradient = _arcGradient;
        }
    }
}`,
  },
  {
    id: 'armored-enemy-ai',
    fileName: 'ArmoredEnemyAI.cs',
    className: 'ArmoredEnemyAI : MonoBehaviour',
    roleSummary:
      'NavMesh & state-machine AI for shielded hoplites, javelineers, and centurions supporting melee charging, ranged projectile volleys, safety-wall breach flanking, shield guard windows, stagger, and Cryo slow.',
    keyHighlights: [
      'Checks line-of-sight against safety wall/bastion cover layers so melee units flank through doorways instead of swinging through walls',
      'Flushes players hiding or camping inside the safety wall by collapsing ranged stop distance after CoverFlushDelay and rushing inside',
      'Lowers left-hand bronze/steel shield slightly during melee windups to reward skilled counter-headshots',
      'Applies Cryo time-dilation multiplier cleanly to NavMeshAgent speed, Animator speed, and attack cooldowns',
    ],
    code: `using UnityEngine;
using UnityEngine.AI;

namespace MetaQuestArchery
{
    public enum EnemyClass { ShieldHoplite, Javelineer, Centurion }
    public enum EnemyState { Advancing, ChargingMelee, RangedWindup, Attacking, Staggered, Defeated }

    [RequireComponent(typeof(NavMeshAgent))]
    public class ArmoredEnemyAI : MonoBehaviour
    {
        [Header("Archetype & Stats")]
        [SerializeField] private EnemyClass enemyClass = EnemyClass.ShieldHoplite;
        [SerializeField] private float maxHealth = 140f;
        [SerializeField] private float walkSpeed = 2.1f;
        [SerializeField] private float chargeSpeedMultiplier = 1.4f;
        [SerializeField] private float attackDamage = 14f;
        [SerializeField] private float attackCooldown = 2.2f;

        [Header("Engagement & Safety-Wall Breach Ranges")]
        [SerializeField] private float meleeStopDistance = 1.65f;
        [SerializeField] private float rangedStopDistance = 19.5f;
        [SerializeField] private float breachStopDistance = 3.2f;
        [SerializeField] private float coverFlushDelay = 2.0f;
        [SerializeField] private float safetyWallZThreshold = -3.45f;
        [SerializeField] private LayerMask coverObstacleMask;
        [SerializeField] private float shieldDropDuringSwing = 0.55f;

        [Header("References")]
        [SerializeField] private Animator animator;
        [SerializeField] private Transform shieldArmPivot;
        [SerializeField] private Transform javelinSpawnPoint;
        [SerializeField] private Rigidbody javelinPrefab;
        [SerializeField] private GameObject frostStasisFx;

        private NavMeshAgent _agent;
        private Transform _playerTarget;
        private PlayerHealthDiegeticUI _playerHealth;
        private EnemyState _state = EnemyState.Advancing;

        private float _currentHp;
        private float _attackTimer;
        private float _staggerTimer;
        private float _cryoTimer;
        private float _coverHiddenTimer;
        private float _timeScale = 1f;

        public float HealthRatio => Mathf.Clamp01(_currentHp / Mathf.Max(1f, maxHealth));
        public bool IsDefeated => _state == EnemyState.Defeated;

        private void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
            _currentHp = maxHealth;
            _agent.speed = walkSpeed;
        }

        public void InitializeTarget(Transform playerEyeTransform, PlayerHealthDiegeticUI healthSystem)
        {
            _playerTarget = playerEyeTransform;
            _playerHealth = healthSystem;
        }

        private void Update()
        {
            if (_state == EnemyState.Defeated || _playerTarget == null) return;

            UpdateStatusTimers();
            float dt = Time.deltaTime * _timeScale;

            if (_state == EnemyState.Staggered)
            {
                _staggerTimer -= Time.deltaTime;
                if (_staggerTimer <= 0f) _state = EnemyState.Advancing;
                return;
            }

            float distToPlayer = Vector3.Distance(transform.position, _playerTarget.position);
            bool clearLos = HasClearLineOfSight(distToPlayer);
            bool playerInsideSafetyWall = _playerTarget.position.z > safetyWallZThreshold;

            if (!clearLos)
            {
                _coverHiddenTimer = Mathf.Min(8f, _coverHiddenTimer + dt);
            }
            else if (playerInsideSafetyWall)
            {
                _coverHiddenTimer = Mathf.Min(8f, _coverHiddenTimer + dt * 0.45f);
            }
            else
            {
                _coverHiddenTimer = Mathf.Max(0f, _coverHiddenTimer - dt * 0.6f);
            }

            Vector3 lookPos = new Vector3(_playerTarget.position.x, transform.position.y, _playerTarget.position.z);
            transform.LookAt(lookPos);

            if (enemyClass == EnemyClass.Javelineer)
            {
                UpdateRangedJavelineer(distToPlayer, clearLos, dt);
            }
            else
            {
                UpdateMeleeCharger(distToPlayer, clearLos, dt);
            }
        }

        private bool HasClearLineOfSight(float distToPlayer)
        {
            if (distToPlayer <= 0.8f || coverObstacleMask.value == 0) return true;
            Vector3 eye = transform.position + Vector3.up * 1.45f;
            Vector3 dir = (_playerTarget.position - eye).normalized;
            return !Physics.Raycast(eye, dir, distToPlayer - 0.25f, coverObstacleMask, QueryTriggerInteraction.Ignore);
        }

        private void UpdateMeleeCharger(float dist, bool clearLos, float dt)
        {
            // Never stop outside a safety wall to swing through cover: route inside around doorways first
            if (dist > meleeStopDistance || !clearLos)
            {
                bool isCharging = dist < 13f;
                _state = isCharging ? EnemyState.ChargingMelee : EnemyState.Advancing;
                _agent.isStopped = false;
                _agent.speed = walkSpeed * (isCharging ? chargeSpeedMultiplier : 1f) * _timeScale;
                _agent.SetDestination(_playerTarget.position);
                SetShieldGuardPose(0.05f);
            }
            else
            {
                _agent.isStopped = true;
                _state = EnemyState.Attacking;
                _attackTimer -= dt;

                // Expose torso/head briefly during windup so player can counter
                SetShieldGuardPose(_attackTimer < 0.6f ? shieldDropDuringSwing : 0.08f);

                if (_attackTimer <= 0f)
                {
                    _attackTimer = attackCooldown;
                    animator?.SetTrigger("MeleeStrike");
                    _playerHealth?.ApplyDamage(attackDamage, $"{enemyClass} Strike");
                }
            }
        }

        private void UpdateRangedJavelineer(float dist, bool clearLos, float dt)
        {
            // If the player hides behind cover or stays inside the safety wall too long, breach inward
            float flushBlend = Mathf.Clamp01((_coverHiddenTimer - coverFlushDelay) / 3.2f);
            float activeStopDistance = Mathf.Lerp(rangedStopDistance, breachStopDistance, flushBlend);

            if (dist > activeStopDistance || (!clearLos && _coverHiddenTimer >= coverFlushDelay))
            {
                _agent.isStopped = false;
                _agent.speed = walkSpeed * (flushBlend > 0.05f ? 1.18f : 1f) * _timeScale;
                _agent.SetDestination(_playerTarget.position);
                _state = EnemyState.Advancing;
            }
            else
            {
                _agent.isStopped = true;
                if (!clearLos) return;

                _attackTimer -= dt;

                if (_attackTimer <= 0.75f && _state != EnemyState.RangedWindup)
                {
                    _state = EnemyState.RangedWindup;
                    animator?.SetTrigger("JavelinWindup");
                }

                if (_attackTimer <= 0f)
                {
                    _attackTimer = attackCooldown;
                    _state = EnemyState.Advancing;
                    ThrowJavelinAtPlayer();
                }
            }
        }

        private void ThrowJavelinAtPlayer()
        {
            if (javelinPrefab == null || javelinSpawnPoint == null || _playerTarget == null) return;

            Rigidbody jav = Instantiate(javelinPrefab, javelinSpawnPoint.position, Quaternion.identity);
            Vector3 toTarget = (_playerTarget.position - Vector3.up * 0.1f) - javelinSpawnPoint.position;
            float flightTime = Mathf.Max(0.35f, toTarget.magnitude / 22f);
            Vector3 launchVel = (toTarget / flightTime) - (0.5f * Physics.gravity * flightTime);

            jav.linearVelocity = launchVel;
            jav.transform.rotation = Quaternion.LookRotation(launchVel.normalized);
        }

        public void ReceiveHitboxDamage(float damage, HitboxZoneType zone, bool bypassShield)
        {
            if (_state == EnemyState.Defeated) return;

            _currentHp = Mathf.Max(0f, _currentHp - damage);
            if (zone == HitboxZoneType.Head || damage >= 80f)
            {
                _staggerTimer = 0.42f;
                _state = EnemyState.Staggered;
                _agent.isStopped = true;
                animator?.SetTrigger("Stagger");
            }
            else if (zone == HitboxZoneType.Limb)
            {
                ApplyCryoSlow(0.45f, 0.9f);
            }

            if (_currentHp <= 0f)
            {
                _state = EnemyState.Defeated;
                _agent.enabled = false;
                animator?.SetTrigger("Die");
                SurvivalCampaignAndArmory.Instance?.NotifyEnemyKilled(enemyClass, zone == HitboxZoneType.Head);
                Destroy(gameObject, 2.2f);
            }
        }

        public void ApplyCryoSlow(float scale, float duration)
        {
            _timeScale = Mathf.Min(_timeScale, scale);
            _cryoTimer = Mathf.Max(_cryoTimer, duration);
            if (frostStasisFx != null) frostStasisFx.SetActive(true);
        }

        private void UpdateStatusTimers()
        {
            if (_cryoTimer > 0f)
            {
                _cryoTimer -= Time.deltaTime;
                if (_cryoTimer <= 0f)
                {
                    _timeScale = 1f;
                    if (frostStasisFx != null) frostStasisFx.SetActive(false);
                }
            }
            if (animator != null) animator.speed = _timeScale;
        }

        private void SetShieldGuardPose(float openWeight)
        {
            if (shieldArmPivot == null) return;
            Quaternion targetRot = Quaternion.Euler(0f, openWeight * 55f, 0f);
            shieldArmPivot.localRotation = Quaternion.Slerp(shieldArmPivot.localRotation, targetRot, Time.deltaTime * 10f);
        }
    }
}`,
  },
  {
    id: 'enemy-hitbox-zone',
    fileName: 'EnemyHitboxZone.cs',
    className: 'EnemyHitboxZone : MonoBehaviour',
    roleSummary:
      'Attach to Head, Torso, Limb, and Shield colliders on ancient warriors to apply precise VR hitbox damage multipliers and metallic shield deflections.',
    keyHighlights: [
      'Defines HitboxZoneType multipliers: Head (2.5x), Torso (1.0x), Limb (0.65x), and Shield (0.0x Block)',
      'Implements IArrowHittable so VRArrowProjectile resolves zone damage cleanly with zero string tags',
      'Allows Thermite explosions or Volt chains to bypass frontal shield blocks when bypassShield is flagged',
    ],
    code: `using UnityEngine;

namespace MetaQuestArchery
{
    public enum HitboxZoneType
    {
        Head = 0,   // 2.5x Critical Headshot
        Torso = 1,  // 1.0x Standard Cuirass Hit
        Limb = 2,   // 0.65x Arm/Leg Slowing Graze
        Shield = 3  // 0.0x Kinetic Deflection
    }

    /// <summary>
    /// Modular per-bone collider receiver implementing IArrowHittable for VR hitbox multipliers.
    /// </summary>
    public class EnemyHitboxZone : MonoBehaviour, IArrowHittable
    {
        [SerializeField] private ArmoredEnemyAI ownerAI;
        [SerializeField] private HitboxZoneType zoneType = HitboxZoneType.Torso;
        [SerializeField] private float customMultiplierOverride = -1f;
        [SerializeField] private ParticleSystem shieldSparkVfx;

        public Transform TargetTransform => transform;

        public float ZoneMultiplier => customMultiplierOverride >= 0f ? customMultiplierOverride : zoneType switch
        {
            HitboxZoneType.Head => 2.5f,
            HitboxZoneType.Torso => 1.0f,
            HitboxZoneType.Limb => 0.65f,
            HitboxZoneType.Shield => 0.0f,
            _ => 1.0f
        };

        public void OnArrowImpact(VRArrowProjectile arrow, RaycastHit hit, float rawDamage, float scoreMultiplier)
        {
            if (ownerAI == null || ownerAI.IsDefeated) return;

            bool isShieldBlock = zoneType == HitboxZoneType.Shield;
            if (isShieldBlock)
            {
                HitboxDebugger.Instance?.RecordImpact(this, hit.point, hit.normal, 0f);
                // Deflect kinetic arrow off bronze/steel shield & spawn sparks
                if (shieldSparkVfx != null) Instantiate(shieldSparkVfx, hit.point, Quaternion.LookRotation(hit.normal));
                return;
            }

            float finalDamage = rawDamage * ZoneMultiplier;
            HitboxDebugger.Instance?.RecordImpact(this, hit.point, hit.normal, finalDamage);
            ownerAI.ReceiveHitboxDamage(finalDamage, zoneType, false);
        }

        public void ApplyCryoFreeze(float slowFactor, float duration)
        {
            if (zoneType != HitboxZoneType.Shield)
            {
                ownerAI?.ApplyCryoSlow(slowFactor, duration);
            }
        }
    }
}`,
  },
  {
    id: 'player-health-diegetic-ui',
    fileName: 'PlayerHealthDiegeticUI.cs',
    className: 'PlayerHealthDiegeticUI : MonoBehaviour',
    roleSummary:
      'Manages VR player health, equipped ancient armor damage mitigation, damage flash vignette, and World-Space Diegetic UI mounted on the bow riser & left wrist.',
    keyHighlights: [
      'Mounts directly on the Left Hand / Bow WorldSpace Canvas for zero screen-space HUD clutter in Meta Quest',
      'Dynamically updates 3D HP bar color (Emerald -> Amber -> Crimson), Wave Enemy count, and Coins readout',
      'Applies Armor + Helmet damageReductionPct and sends OVR/XR haptic damage impulses on player hits',
    ],
    code: `using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR;
using TMPro;

namespace MetaQuestArchery
{
    /// <summary>
    /// VR Player Health & Diegetic Bow/Wrist UI controller for Meta Quest immersion.
    /// </summary>
    public class PlayerHealthDiegeticUI : MonoBehaviour
    {
        [Header("Health & Armor Defense")]
        [SerializeField] private float baseMaxHp = 100f;
        [Range(0f, 0.6f)]
        [SerializeField] private float armorMitigationFraction = 0f;

        [Header("Diegetic World-Space Bow/Wrist UI")]
        [SerializeField] private Image hpFillBar;
        [SerializeField] private Image drawTensionFillBar;
        [SerializeField] private TMP_Text hpText;
        [SerializeField] private TMP_Text waveStatusText;
        [SerializeField] private TMP_Text coinCountText;

        [Header("Immersion Feedback")]
        [SerializeField] private CanvasGroup damageVignetteCanvas;
        [SerializeField] private MeshRenderer gauntletTrimRenderer;

        private float _maxHp;
        private float _currentHp;
        private float _vignetteAlpha;

        public float HealthRatio => Mathf.Clamp01(_currentHp / Mathf.Max(1f, _maxHp));
        public bool IsAlive => _currentHp > 0f;

        public void ConfigureArmorStats(float bonusHp, float mitigationFraction, Color armorColor, Color trimColor)
        {
            _maxHp = baseMaxHp + bonusHp;
            armorMitigationFraction = Mathf.Clamp(mitigationFraction, 0f, 0.6f);
            _currentHp = _maxHp;

            if (gauntletTrimRenderer != null)
            {
                gauntletTrimRenderer.material.color = armorColor;
                gauntletTrimRenderer.material.SetColor("_EmissionColor", trimColor * 0.6f);
            }
            RefreshDiegeticBars();
        }

        private void Update()
        {
            if (_vignetteAlpha > 0f && damageVignetteCanvas != null)
            {
                _vignetteAlpha = Mathf.Max(0f, _vignetteAlpha - Time.deltaTime * 2.2f);
                damageVignetteCanvas.alpha = _vignetteAlpha;
            }
        }

        public void ApplyDamage(float rawIncomingDamage, string sourceLabel)
        {
            if (!IsAlive) return;

            float mitigated = Mathf.Max(1f, rawIncomingDamage * (1f - armorMitigationFraction));
            _currentHp = Mathf.Max(0f, _currentHp - mitigated);
            _vignetteAlpha = 0.78f;

            TriggerControllerDamageHaptic(XRNode.LeftHand);
            TriggerControllerDamageHaptic(XRNode.RightHand);
            RefreshDiegeticBars();

            if (_currentHp <= 0f)
            {
                SurvivalCampaignAndArmory.Instance?.OnPlayerDefeated();
            }
        }

        public void UpdateDiegeticWaveAndTension(int enemiesAlive, int totalEnemies, int coins, float drawTension)
        {
            if (waveStatusText != null) waveStatusText.text = $"FOES {enemiesAlive}/{totalEnemies}";
            if (coinCountText != null) coinCountText.text = $"{coins}c";
            if (drawTensionFillBar != null)
            {
                drawTensionFillBar.fillAmount = drawTension;
                drawTensionFillBar.color = drawTension < 0.55f
                    ? Color.Lerp(Color.green, Color.yellow, drawTension / 0.55f)
                    : Color.Lerp(Color.yellow, Color.red, (drawTension - 0.55f) / 0.45f);
            }
        }

        private void RefreshDiegeticBars()
        {
            if (hpFillBar != null)
            {
                hpFillBar.fillAmount = HealthRatio;
                hpFillBar.color = Color.Lerp(Color.red, new Color(0.13f, 0.77f, 0.37f), HealthRatio);
            }
            if (hpText != null) hpText.text = $"{Mathf.CeilToInt(_currentHp)}/{Mathf.CeilToInt(_maxHp)}";
        }

        private void TriggerControllerDamageHaptic(XRNode node)
        {
            InputDevice dev = InputDevices.GetDeviceAtXRNode(node);
            if (dev.isValid && dev.TryGetHapticCapabilities(out HapticCapabilities caps) && caps.supportsImpulse)
            {
                dev.SendHapticImpulse(0u, 0.85f, 0.14f);
            }
        }
    }
}`,
  },
  {
    id: 'survival-campaign-armory',
    fileName: 'SurvivalCampaignAndArmory.cs',
    className: 'SurvivalCampaignAndArmory : MonoBehaviour',
    roleSummary:
      'Coordinates 5-season, 50-level 3-star progression, Star-Gate season unlocking, Coin economy, and Ancient Armor & Helmet ScriptableObject customization.',
    keyHighlights: [
      'Evaluates 1-3 Stars on level victory from PlayerHealthDiegeticUI.HealthRatio (3★ >= 80%, 2★ >= 45%)',
      'Enforces Star thresholds to unlock Seasons 1..5 and persists progress & Coins via PlayerPrefs',
      'Allows buying & equipping AncientArmorItem assets to boost Max HP, damage mitigation, and gauntlet visuals',
    ],
    code: `using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    [CreateAssetMenu(fileName = "AncientGear", menuName = "VR Archery/Ancient Armor or Helmet")]
    public class AncientArmorGearData : ScriptableObject
    {
        public string gearId;
        public bool isHelmet;
        public string displayName;
        public int coinCost = 150;
        public float bonusMaxHp = 25f;
        [Range(0f, 0.4f)] public float mitigationFraction = 0.1f;
        public Color primaryMetalColor = new Color(0.71f, 0.33f, 0.04f);
        public Color trimAccentColor = new Color(0.98f, 0.75f, 0.14f);
    }

    public class SurvivalCampaignAndArmory : MonoBehaviour
    {
        public static SurvivalCampaignAndArmory Instance { get; private set; }

        [Header("5-Season Star Unlock Thresholds")]
        [SerializeField] private int[] seasonRequiredStars = { 0, 12, 28, 48, 70 };

        [Header("Armory Loadout")]
        [SerializeField] private AncientArmorGearData equippedArmor;
        [SerializeField] private AncientArmorGearData equippedHelmet;
        [SerializeField] private PlayerHealthDiegeticUI playerHealthUI;

        private int _totalCoins;
        private int _totalStars;
        private int _currentLevel = 1;
        private int _enemiesRemaining;
        private readonly HashSet<string> _ownedGearIds = new HashSet<string>();

        private void Awake()
        {
            Instance = this;
            _totalCoins = PlayerPrefs.GetInt("VR_TotalCoins", 0);
            _totalStars = PlayerPrefs.GetInt("VR_TotalStars", 0);
            ApplyEquippedGear();
        }

        public bool IsSeasonUnlocked(int seasonIndexZeroBased)
        {
            int idx = Mathf.Clamp(seasonIndexZeroBased, 0, seasonRequiredStars.Length - 1);
            return _totalStars >= seasonRequiredStars[idx];
        }

        public void StartLevel(int levelNumber, int enemyCount)
        {
            _currentLevel = Mathf.Clamp(levelNumber, 1, 50);
            _enemiesRemaining = enemyCount;
            ApplyEquippedGear();
        }

        public void NotifyEnemyKilled(EnemyClass enemyClass, bool wasHeadshot)
        {
            _enemiesRemaining = Mathf.Max(0, _enemiesRemaining - 1);
            _totalCoins += (enemyClass == EnemyClass.Centurion ? 25 : 14) + (wasHeadshot ? 12 : 0);

            if (_enemiesRemaining == 0 && playerHealthUI != null && playerHealthUI.IsAlive)
            {
                CompleteCurrentLevel();
            }
        }

        private void CompleteCurrentLevel()
        {
            float hpRatio = playerHealthUI.HealthRatio;
            int stars = hpRatio >= 0.80f ? 3 : (hpRatio >= 0.45f ? 2 : 1);

            int prevStars = PlayerPrefs.GetInt($"VR_LevelStars_{_currentLevel}", 0);
            if (stars > prevStars)
            {
                _totalStars += (stars - prevStars);
                PlayerPrefs.SetInt($"VR_LevelStars_{_currentLevel}", stars);
                PlayerPrefs.SetInt("VR_TotalStars", _totalStars);
            }

            _totalCoins += 45 + _currentLevel * 5 + stars * 15;
            PlayerPrefs.SetInt("VR_TotalCoins", _totalCoins);
            PlayerPrefs.Save();
        }

        public void OnPlayerDefeated()
        {
            // Trigger retry UI & preserve earned combat coins
            PlayerPrefs.SetInt("VR_TotalCoins", _totalCoins);
            PlayerPrefs.Save();
        }

        public bool TryPurchaseAndEquip(AncientArmorGearData gear)
        {
            if (gear == null) return false;
            if (!_ownedGearIds.Contains(gear.gearId))
            {
                if (_totalCoins < gear.coinCost) return false;
                _totalCoins -= gear.coinCost;
                _ownedGearIds.Add(gear.gearId);
            }

            if (gear.isHelmet) equippedHelmet = gear;
            else equippedArmor = gear;

            ApplyEquippedGear();
            return true;
        }

        private void ApplyEquippedGear()
        {
            if (playerHealthUI == null) return;
            float bonusHp = (equippedArmor != null ? equippedArmor.bonusMaxHp : 0f) +
                            (equippedHelmet != null ? equippedHelmet.bonusMaxHp : 0f);
            float mitigation = (equippedArmor != null ? equippedArmor.mitigationFraction : 0f) +
                               (equippedHelmet != null ? equippedHelmet.mitigationFraction : 0f);
            Color primary = equippedArmor != null ? equippedArmor.primaryMetalColor : Color.gray;
            Color trim = equippedHelmet != null ? equippedHelmet.trimAccentColor : Color.cyan;
            playerHealthUI.ConfigureArmorStats(bonusHp, mitigation, primary, trim);
        }
    }
}`,
  },
  {
    id: 'vr-player-locomotion-cover',
    fileName: 'VRPlayerLocomotionAndCover.cs',
    className: 'VRPlayerLocomotionAndCover : MonoBehaviour',
    roleSummary:
      'Meta Quest 3D VR locomotion controller enabling smooth HMD-oriented left/right/forward/back walking, Sprint, physical/button Crouch, and Line-of-Sight cover stealth detection against enemies.',
    keyHighlights: [
      'Reads Meta Quest Left Thumbstick + Sprint Click + Right-Hand Crouch toggle, moving CharacterController relative to CenterEyeCamera XZ forward/right',
      'Smoothly shrinks CharacterController capsule height during physical or toggle crouch so players duck behind 1.2m timber walls and stone bastions',
      'Evaluates Physics.Linecast occlusion from active enemies to player HMD eye position to grant stealth cover status and block incoming javelins',
    ],
    code: `using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    public enum PlayerStanceState
    {
        Standing = 0,
        Walking = 1,
        Sprinting = 2,
        CrouchedExposed = 3,
        HiddenInCover = 4
    }

    /// <summary>
    /// 3D Meta Quest VR Locomotion & Tactical Cover Stealth Controller:
    /// Handles Left/Right/Forward/Back HMD-directed Walk, Sprint, Crouch, and Enemy LOS cover occlusion.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class VRPlayerLocomotionAndCover : MonoBehaviour
    {
        [Header("XR Rig References")]
        [SerializeField] private Transform centerEyeCamera;
        [SerializeField] private LayerMask coverLayerMask;

        [Header("Walk, Run & Crouch Speeds")]
        [SerializeField] private float walkSpeed = 4.3f;
        [SerializeField] private float sprintSpeed = 7.9f;
        [SerializeField] private float crouchedSpeed = 2.55f;
        [SerializeField] private float standingHeight = 1.68f;
        [SerializeField] private float crouchedHeight = 0.94f;
        [SerializeField] private float gravity = -16f;

        [Header("Stealth Cover Check")]
        [SerializeField] private float closeDetectionRadius = 2.75f;

        private CharacterController _controller;
        private readonly List<Transform> _trackedEnemyEyes = new List<Transform>();
        private float _verticalVelocity;
        private bool _crouchToggled;
        private bool _crouchBtnWasPressed;

        public PlayerStanceState CurrentStance { get; private set; } = PlayerStanceState.Standing;
        public bool IsHiddenFromEnemies { get; private set; }

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        public void RegisterEnemyEye(Transform enemyEye)
        {
            if (enemyEye != null && !_trackedEnemyEyes.Contains(enemyEye))
                _trackedEnemyEyes.Add(enemyEye);
        }

        public void UnregisterEnemyEye(Transform enemyEye)
        {
            _trackedEnemyEyes.Remove(enemyEye);
        }

        private void Update()
        {
            HandleVRInputLocomotion();
            EvaluateCoverStealthLineOfSight();
        }

        private void HandleVRInputLocomotion()
        {
            InputDevice leftHand = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            InputDevice rightHand = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);

            // Toggle crouch via Right Controller Secondary Button (B) OR detect physical Quest room-scale ducking
            if (rightHand.isValid && rightHand.TryGetFeatureValue(CommonUsages.secondaryButton, out bool bPressed))
            {
                if (bPressed && !_crouchBtnWasPressed) _crouchToggled = !_crouchToggled;
                _crouchBtnWasPressed = bPressed;
            }

            float physicalHeadHeight = centerEyeCamera != null ? centerEyeCamera.localPosition.y : standingHeight;
            bool isCrouched = _crouchToggled || physicalHeadHeight < 1.25f;

            Vector2 stickInput = Vector2.zero;
            bool sprintPressed = false;
            if (leftHand.isValid)
            {
                leftHand.TryGetFeatureValue(CommonUsages.primary2DAxis, out stickInput);
                leftHand.TryGetFeatureValue(CommonUsages.primary2DAxisClick, out sprintPressed);
            }

            // Smoothly adjust CharacterController collider height for crouching behind 1.18m cover walls
            float targetCapsuleH = isCrouched ? crouchedHeight : standingHeight;
            _controller.height = Mathf.Lerp(_controller.height, targetCapsuleH, Time.deltaTime * 12f);
            _controller.center = new Vector3(0f, _controller.height * 0.5f, 0f);

            // Compute HMD-oriented XZ movement directions
            Vector3 fwd = centerEyeCamera != null ? centerEyeCamera.forward : transform.forward;
            Vector3 right = centerEyeCamera != null ? centerEyeCamera.right : transform.right;
            fwd.y = 0f; right.y = 0f;
            fwd.Normalize(); right.Normalize();

            bool hasMove = stickInput.sqrMagnitude > 0.04f;
            bool isSprinting = hasMove && sprintPressed && !isCrouched;
            float activeSpeed = isCrouched ? crouchedSpeed : (isSprinting ? sprintSpeed : walkSpeed);

            Vector3 moveHoriz = (fwd * stickInput.y + right * stickInput.x) * activeSpeed;
            if (_controller.isGrounded && _verticalVelocity < 0f) _verticalVelocity = -1.5f;
            _verticalVelocity += gravity * Time.deltaTime;

            Vector3 velocity = moveHoriz + Vector3.up * _verticalVelocity;
            _controller.Move(velocity * Time.deltaTime);

            if (IsHiddenFromEnemies) CurrentStance = PlayerStanceState.HiddenInCover;
            else if (isCrouched) CurrentStance = PlayerStanceState.CrouchedExposed;
            else if (isSprinting) CurrentStance = PlayerStanceState.Sprinting;
            else if (hasMove) CurrentStance = PlayerStanceState.Walking;
            else CurrentStance = PlayerStanceState.Standing;
        }

        private void EvaluateCoverStealthLineOfSight()
        {
            if (centerEyeCamera == null || _trackedEnemyEyes.Count == 0)
            {
                IsHiddenFromEnemies = false;
                return;
            }

            Vector3 eyePos = centerEyeCamera.position;
            int enemiesWithClearSight = 0;

            for (int i = _trackedEnemyEyes.Count - 1; i >= 0; i--)
            {
                Transform enemyEye = _trackedEnemyEyes[i];
                if (enemyEye == null)
                {
                    _trackedEnemyEyes.RemoveAt(i);
                    continue;
                }

                float dist = Vector3.Distance(enemyEye.position, eyePos);
                if (dist <= closeDetectionRadius)
                {
                    enemiesWithClearSight++;
                    continue;
                }

                bool occluded = Physics.Linecast(enemyEye.position, eyePos, coverLayerMask, QueryTriggerInteraction.Ignore);
                if (!occluded)
                {
                    enemiesWithClearSight++;
                }
            }

            IsHiddenFromEnemies = enemiesWithClearSight == 0;
        }
    }
}`,
  },
  {
    id: 'hitbox-debugger',
    fileName: 'HitboxDebugger.cs',
    className: 'HitboxDebugger : MonoBehaviour',
    roleSummary:
      'Unity Scene View wireframe collider visualizer for EnemyHitboxZone components during Play Mode, color-coded by damage multiplier with recent arrow impact markers.',
    keyHighlights: [
      'Draws transform-accurate wireframe BoxCollider, SphereCollider, CapsuleCollider, and MeshCollider volumes via OnDrawGizmos',
      'Color-codes hitboxes by HitboxZoneType (Head 2.5x Red, Torso 1.0x Gold, Limb 0.65x Emerald, Shield 0.0x Cyan)',
      'Records recent arrow hit points & surface normals + wraps UnityEditor.Handles labels safely in #if UNITY_EDITOR for Quest builds',
    ],
    code: `using System.Collections.Generic;
using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace MetaQuestArchery
{
    /// <summary>
    /// Renders wireframe colliders and damage-zone labels for EnemyHitboxZone components
    /// in the Unity Scene View during Play Mode to troubleshoot precision arrow hit detection.
    /// Attach to any individual enemy root or a single scene-wide DebugManager GameObject.
    /// </summary>
    public class HitboxDebugger : MonoBehaviour
    {
        private struct RecordedImpact
        {
            public EnemyHitboxZone Zone;
            public Vector3 WorldPoint;
            public Vector3 SurfaceNormal;
            public float DamageDealt;
            public float Timestamp;
        }

        [Header("Debug Visibility")]
        [SerializeField] private bool renderOnlyInPlayMode = true;
        [SerializeField] private bool includeAllSceneEnemies = true;
        [SerializeField] private bool drawZoneLabels = true;
        [SerializeField] private bool drawSemiTransparentFill = false;
        [Range(0.05f, 0.45f)]
        [SerializeField] private float fillAlpha = 0.14f;

        [Header("Zone Wireframe Colors")]
        [SerializeField] private Color headColor = new Color(0.96f, 0.26f, 0.26f, 1f);    // 2.5x Crit
        [SerializeField] private Color torsoColor = new Color(0.98f, 0.72f, 0.14f, 1f);   // 1.0x Standard
        [SerializeField] private Color limbColor = new Color(0.16f, 0.85f, 0.54f, 1f);    // 0.65x Graze
        [SerializeField] private Color shieldColor = new Color(0.22f, 0.78f, 0.98f, 1f);  // 0.0x Block
        [SerializeField] private Color recentHitColor = Color.white;

        [Header("Scanning & Impact History")]
        [SerializeField] private float refreshScanInterval = 0.5f;
        [SerializeField] private float impactFlashDuration = 1.15f;
        [SerializeField] private KeyCode toggleKey = KeyCode.F3;

        private readonly List<EnemyHitboxZone> _cachedZones = new List<EnemyHitboxZone>(64);
        private readonly List<RecordedImpact> _recentImpacts = new List<RecordedImpact>(16);
        private float _nextScanTime;
        private bool _debugEnabled = true;

        public static HitboxDebugger Instance { get; private set; }

        private void OnEnable()
        {
            Instance = this;
            RefreshHitboxCache();
        }

        private void OnDisable()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                _debugEnabled = !_debugEnabled;
            }

            if (Time.unscaledTime >= _nextScanTime)
            {
                RefreshHitboxCache();
                _nextScanTime = Time.unscaledTime + refreshScanInterval;
            }

            // Expire old impact markers
            for (int i = _recentImpacts.Count - 1; i >= 0; i--)
            {
                if (Time.unscaledTime - _recentImpacts[i].Timestamp > impactFlashDuration)
                {
                    _recentImpacts.RemoveAt(i);
                }
            }
        }

        /// <summary>
        /// Call from EnemyHitboxZone.OnArrowImpact to flash the struck wireframe collider
        /// and display exact impact point + normal vector in Scene View.
        /// </summary>
        public void RecordImpact(EnemyHitboxZone zone, Vector3 worldPoint, Vector3 surfaceNormal, float finalDamage)
        {
            _recentImpacts.Add(new RecordedImpact
            {
                Zone = zone,
                WorldPoint = worldPoint,
                SurfaceNormal = surfaceNormal.normalized,
                DamageDealt = finalDamage,
                Timestamp = Time.unscaledTime
            });
        }

        [ContextMenu("Refresh Enemy Hitbox Cache")]
        public void RefreshHitboxCache()
        {
            _cachedZones.Clear();
            if (includeAllSceneEnemies)
            {
#if UNITY_2023_1_OR_NEWER
                EnemyHitboxZone[] all = FindObjectsByType<EnemyHitboxZone>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
                EnemyHitboxZone[] all = FindObjectsOfType<EnemyHitboxZone>();
#endif
                _cachedZones.AddRange(all);
            }
            else
            {
                GetComponentsInChildren(false, _cachedZones);
            }
        }

        private void OnDrawGizmos()
        {
            if (!_debugEnabled) return;
            if (renderOnlyInPlayMode && !Application.isPlaying) return;

            if (_cachedZones.Count == 0 && !Application.isPlaying)
            {
                RefreshHitboxCache();
            }

            Matrix4x4 prevMatrix = Gizmos.matrix;
            Color prevColor = Gizmos.color;

            for (int i = 0; i < _cachedZones.Count; i++)
            {
                EnemyHitboxZone zone = _cachedZones[i];
                if (zone == null || !zone.gameObject.activeInHierarchy) continue;

                Collider col = zone.GetComponent<Collider>();
                if (col == null || !col.enabled) continue;

                bool wasRecentlyStruck = TryGetRecentZoneHit(zone, out RecordedImpact lastHit);
                Color wireColor = wasRecentlyStruck
                    ? Color.Lerp(GetZoneColor(zone), recentHitColor, 0.75f)
                    : GetZoneColor(zone);

                DrawColliderWireframe(col, wireColor);
                DrawSceneLabel(zone, col, wireColor, wasRecentlyStruck ? lastHit.DamageDealt : -1f);
            }

            // Draw exact arrow impact points & surface normal rays
            for (int i = 0; i < _recentImpacts.Count; i++)
            {
                RecordedImpact impact = _recentImpacts[i];
                float life = 1f - Mathf.Clamp01((Time.unscaledTime - impact.Timestamp) / impactFlashDuration);
                Gizmos.matrix = Matrix4x4.identity;
                Gizmos.color = new Color(1f, 0.95f, 0.25f, life);
                Gizmos.DrawWireSphere(impact.WorldPoint, 0.045f);
                Gizmos.DrawRay(impact.WorldPoint, impact.SurfaceNormal * 0.28f);
            }

            Gizmos.matrix = prevMatrix;
            Gizmos.color = prevColor;
        }

        private Color GetZoneColor(EnemyHitboxZone zone)
        {
            float mult = zone.ZoneMultiplier;
            if (mult >= 2.0f) return headColor;
            if (mult <= 0.01f) return shieldColor;
            if (mult < 0.85f) return limbColor;
            return torsoColor;
        }

        private bool TryGetRecentZoneHit(EnemyHitboxZone zone, out RecordedImpact found)
        {
            for (int i = _recentImpacts.Count - 1; i >= 0; i--)
            {
                if (_recentImpacts[i].Zone == zone)
                {
                    found = _recentImpacts[i];
                    return true;
                }
            }
            found = default;
            return false;
        }

        private void DrawColliderWireframe(Collider col, Color wireColor)
        {
            Transform t = col.transform;
            Gizmos.color = wireColor;

            if (col is BoxCollider box)
            {
                Gizmos.matrix = Matrix4x4.TRS(t.position, t.rotation, t.lossyScale);
                Gizmos.DrawWireCube(box.center, box.size);
                if (drawSemiTransparentFill)
                {
                    Gizmos.color = new Color(wireColor.r, wireColor.g, wireColor.b, fillAlpha);
                    Gizmos.DrawCube(box.center, box.size);
                }
            }
            else if (col is SphereCollider sphere)
            {
                Vector3 s = t.lossyScale;
                float maxScale = Mathf.Max(Mathf.Abs(s.x), Mathf.Abs(s.y), Mathf.Abs(s.z));
                Vector3 worldCenter = t.TransformPoint(sphere.center);
                Gizmos.matrix = Matrix4x4.TRS(worldCenter, t.rotation, Vector3.one);
                Gizmos.DrawWireSphere(Vector3.zero, sphere.radius * maxScale);
                if (drawSemiTransparentFill)
                {
                    Gizmos.color = new Color(wireColor.r, wireColor.g, wireColor.b, fillAlpha);
                    Gizmos.DrawSphere(Vector3.zero, sphere.radius * maxScale);
                }
            }
            else if (col is CapsuleCollider capsule)
            {
                DrawWireCapsule(t, capsule, wireColor);
            }
            else if (col is MeshCollider meshCol && meshCol.sharedMesh != null)
            {
                Gizmos.matrix = Matrix4x4.TRS(t.position, t.rotation, t.lossyScale);
                Gizmos.DrawWireMesh(meshCol.sharedMesh);
            }
            else
            {
                Gizmos.matrix = Matrix4x4.identity;
                Gizmos.DrawWireCube(col.bounds.center, col.bounds.size);
            }
        }

        private void DrawWireCapsule(Transform t, CapsuleCollider cap, Color wireColor)
        {
            Gizmos.color = wireColor;
            Vector3 lossy = t.lossyScale;
            Vector3 axis = cap.direction == 0 ? Vector3.right : (cap.direction == 1 ? Vector3.up : Vector3.forward);
            float axisScale = cap.direction == 0 ? Mathf.Abs(lossy.x) : (cap.direction == 1 ? Mathf.Abs(lossy.y) : Mathf.Abs(lossy.z));
            float radialScale = cap.direction == 0
                ? Mathf.Max(Mathf.Abs(lossy.y), Mathf.Abs(lossy.z))
                : (cap.direction == 1
                    ? Mathf.Max(Mathf.Abs(lossy.x), Mathf.Abs(lossy.z))
                    : Mathf.Max(Mathf.Abs(lossy.x), Mathf.Abs(lossy.y)));

            float worldRadius = cap.radius * radialScale;
            float worldHeight = Mathf.Max(worldRadius * 2f, cap.height * axisScale);
            float halfBody = Mathf.Max(0f, (worldHeight * 0.5f) - worldRadius);

            Vector3 worldCenter = t.TransformPoint(cap.center);
            Quaternion rot = t.rotation * Quaternion.FromToRotation(Vector3.up, axis);
            Vector3 upDir = rot * Vector3.up;
            Vector3 rightDir = rot * Vector3.right;
            Vector3 fwdDir = rot * Vector3.forward;

            Vector3 topCenter = worldCenter + upDir * halfBody;
            Vector3 botCenter = worldCenter - upDir * halfBody;

            Gizmos.matrix = Matrix4x4.identity;
            Gizmos.DrawWireSphere(topCenter, worldRadius);
            Gizmos.DrawWireSphere(botCenter, worldRadius);

            // 4 longitudinal cylinder struts linking the top and bottom hemispheres
            Gizmos.DrawLine(topCenter + rightDir * worldRadius, botCenter + rightDir * worldRadius);
            Gizmos.DrawLine(topCenter - rightDir * worldRadius, botCenter - rightDir * worldRadius);
            Gizmos.DrawLine(topCenter + fwdDir * worldRadius, botCenter + fwdDir * worldRadius);
            Gizmos.DrawLine(topCenter - fwdDir * worldRadius, botCenter - fwdDir * worldRadius);
        }

        private void DrawSceneLabel(EnemyHitboxZone zone, Collider col, Color labelColor, float lastDamage)
        {
#if UNITY_EDITOR
            if (!drawZoneLabels) return;
            Camera sceneCam = SceneView.currentDrawingSceneView != null
                ? SceneView.currentDrawingSceneView.camera
                : Camera.current;
            if (sceneCam != null && Vector3.Distance(sceneCam.transform.position, col.bounds.center) > 45f)
                return;

            string dmgTag = lastDamage >= 0f ? $" [HIT {lastDamage:F0}]" : string.Empty;
            GUIStyle style = new GUIStyle(EditorStyles.miniBoldLabel)
            {
                normal = { textColor = labelColor },
                alignment = TextAnchor.MiddleCenter
            };
            Handles.Label(col.bounds.center, $"{zone.ZoneMultiplier:0.00}x{dmgTag}", style);
#endif
        }
    }
}`,
  },
  {
    id: 'vibration-controller',
    fileName: 'VibrationController.cs',
    className: 'VibrationController : MonoBehaviour',
    roleSummary:
      'Meta Quest OVRInput haptic controller generating distinct frequency, amplitude, and dual-pulse vibration impulses when arrows impact Wood, Stone, Enemy Armor, or Shields.',
    keyHighlights: [
      'Uses Meta Quest OVRInput.SetControllerVibration(frequency, amplitude, controller) with per-hand coroutine stop timers',
      'Inspects EnemyHitboxZone (Head/Torso/Limb/Shield) and SurfaceMaterialTag (Wood/Stone/Metal) to select distinct haptic profiles automatically',
      'Cleanly zeroes left and right controller haptics on disable/pause so Quest Touch motors never remain latched',
    ],
    code: `using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    public enum ImpactHapticMaterial
    {
        Wood = 0,
        Stone = 1,
        EnemyArmor = 2,
        EnemyShield = 3,
        CriticalHeadshot = 4
    }

    [Serializable]
    public struct MaterialHapticProfile
    {
        [Range(0f, 1f)] public float frequency;
        [Range(0f, 1f)] public float amplitude;
        [Range(0.02f, 0.5f)] public float durationSeconds;
        public bool sendSecondaryEchoPulse;
        [Range(0.02f, 0.25f)] public float echoDelaySeconds;
        [Range(0f, 1f)] public float echoAmplitudeScale;
        public bool vibrateBothHands;
    }

    /// <summary>
    /// Interfaces with Meta Quest's OVRInput API to deliver distinct material-specific
    /// haptic impulses for Wood, Stone, Enemy Armor, Shield Blocks, and Critical Headshots.
    /// </summary>
    public class VibrationController : MonoBehaviour
    {
        public static VibrationController Instance { get; private set; }

        [Header("Default Quest Bow Hand")]
        [Tooltip("Controller holding the bow riser (receives arrow impact & recoil impulses)")]
        [SerializeField] private OVRInput.Controller primaryBowController = OVRInput.Controller.LTouch;
        [SerializeField] private float globalIntensityMultiplier = 1.0f;

        [Header("Material Haptic Profiles (OVRInput)")]
        [SerializeField] private MaterialHapticProfile woodProfile = new MaterialHapticProfile
        {
            frequency = 0.28f,
            amplitude = 0.42f,
            durationSeconds = 0.085f,
            sendSecondaryEchoPulse = false,
            echoDelaySeconds = 0.05f,
            echoAmplitudeScale = 0.4f,
            vibrateBothHands = false
        };

        [SerializeField] private MaterialHapticProfile stoneProfile = new MaterialHapticProfile
        {
            frequency = 0.76f,
            amplitude = 0.68f,
            durationSeconds = 0.06f,
            sendSecondaryEchoPulse = true,
            echoDelaySeconds = 0.04f,
            echoAmplitudeScale = 0.35f,
            vibrateBothHands = false
        };

        [SerializeField] private MaterialHapticProfile enemyArmorProfile = new MaterialHapticProfile
        {
            frequency = 0.90f,
            amplitude = 0.85f,
            durationSeconds = 0.11f,
            sendSecondaryEchoPulse = true,
            echoDelaySeconds = 0.06f,
            echoAmplitudeScale = 0.55f,
            vibrateBothHands = false
        };

        [SerializeField] private MaterialHapticProfile enemyShieldProfile = new MaterialHapticProfile
        {
            frequency = 1.00f,
            amplitude = 0.95f,
            durationSeconds = 0.14f,
            sendSecondaryEchoPulse = true,
            echoDelaySeconds = 0.075f,
            echoAmplitudeScale = 0.65f,
            vibrateBothHands = true
        };

        [SerializeField] private MaterialHapticProfile criticalHeadshotProfile = new MaterialHapticProfile
        {
            frequency = 1.00f,
            amplitude = 1.00f,
            durationSeconds = 0.16f,
            sendSecondaryEchoPulse = true,
            echoDelaySeconds = 0.065f,
            echoAmplitudeScale = 0.72f,
            vibrateBothHands = true
        };

        private readonly Dictionary<OVRInput.Controller, Coroutine> _activeRoutines =
            new Dictionary<OVRInput.Controller, Coroutine>(4);

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
        }

        private void OnDisable()
        {
            StopAllVibrations();
            if (Instance == this) Instance = null;
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused) StopAllVibrations();
        }

        public void SetPrimaryBowController(OVRInput.Controller controller)
        {
            primaryBowController = controller;
        }

        /// <summary>
        /// Automatically inspects EnemyHitboxZone or SurfaceMaterialTag on a struck Collider
        /// and fires the matching OVRInput haptic impulse.
        /// </summary>
        public void TriggerImpactFromCollider(Collider hitCollider, float normalizedVelocity = 1f)
        {
            ImpactHapticMaterial resolved = ImpactHapticMaterial.Wood;

            if (hitCollider != null)
            {
                EnemyHitboxZone hitbox = hitCollider.GetComponentInParent<EnemyHitboxZone>();
                if (hitbox != null)
                {
                    float mult = hitbox.ZoneMultiplier;
                    if (mult >= 2.0f) resolved = ImpactHapticMaterial.CriticalHeadshot;
                    else if (mult <= 0.01f) resolved = ImpactHapticMaterial.EnemyShield;
                    else resolved = ImpactHapticMaterial.EnemyArmor;
                }
                else
                {
                    SurfaceMaterialTag tag = hitCollider.GetComponentInParent<SurfaceMaterialTag>();
                    if (tag != null)
                    {
                        resolved = tag.materialType switch
                        {
                            SurfaceMaterialType.Stone => ImpactHapticMaterial.Stone,
                            SurfaceMaterialType.Metal => ImpactHapticMaterial.EnemyArmor,
                            _ => ImpactHapticMaterial.Wood
                        };
                    }
                }
            }

            TriggerMaterialImpact(resolved, normalizedVelocity);
        }

        /// <summary>
        /// Explicitly triggers a material-tuned OVRInput controller vibration pulse.
        /// </summary>
        public void TriggerMaterialImpact(
            ImpactHapticMaterial material,
            float intensityScale = 1f,
            OVRInput.Controller? controllerOverride = null)
        {
            MaterialHapticProfile profile = GetProfileForMaterial(material);
            float clampedScale = Mathf.Clamp(intensityScale, 0.3f, 1.25f) * globalIntensityMultiplier;

            if (profile.vibrateBothHands && !controllerOverride.HasValue)
            {
                PlayOnController(OVRInput.Controller.LTouch, profile, clampedScale);
                PlayOnController(OVRInput.Controller.RTouch, profile, clampedScale * 0.85f);
            }
            else
            {
                OVRInput.Controller target = controllerOverride ?? primaryBowController;
                PlayOnController(target, profile, clampedScale);
            }
        }

        public void StopAllVibrations()
        {
            StopAllCoroutines();
            _activeRoutines.Clear();
            OVRInput.SetControllerVibration(0f, 0f, OVRInput.Controller.LTouch);
            OVRInput.SetControllerVibration(0f, 0f, OVRInput.Controller.RTouch);
        }

        private MaterialHapticProfile GetProfileForMaterial(ImpactHapticMaterial material) => material switch
        {
            ImpactHapticMaterial.Stone => stoneProfile,
            ImpactHapticMaterial.EnemyArmor => enemyArmorProfile,
            ImpactHapticMaterial.EnemyShield => enemyShieldProfile,
            ImpactHapticMaterial.CriticalHeadshot => criticalHeadshotProfile,
            _ => woodProfile
        };

        private void PlayOnController(OVRInput.Controller controller, MaterialHapticProfile profile, float scale)
        {
            if (_activeRoutines.TryGetValue(controller, out Coroutine running) && running != null)
            {
                StopCoroutine(running);
            }
            _activeRoutines[controller] = StartCoroutine(HapticPulseRoutine(controller, profile, scale));
        }

        private IEnumerator HapticPulseRoutine(
            OVRInput.Controller controller,
            MaterialHapticProfile profile,
            float scale)
        {
            float amp = Mathf.Clamp01(profile.amplitude * scale);
            float freq = Mathf.Clamp01(profile.frequency);

            OVRInput.SetControllerVibration(freq, amp, controller);
            yield return new WaitForSecondsRealtime(profile.durationSeconds);
            OVRInput.SetControllerVibration(0f, 0f, controller);

            if (profile.sendSecondaryEchoPulse)
            {
                yield return new WaitForSecondsRealtime(profile.echoDelaySeconds);
                float echoAmp = Mathf.Clamp01(amp * profile.echoAmplitudeScale);
                OVRInput.SetControllerVibration(Mathf.Clamp01(freq * 1.05f), echoAmp, controller);
                yield return new WaitForSecondsRealtime(profile.durationSeconds * 0.65f);
                OVRInput.SetControllerVibration(0f, 0f, controller);
            }

            _activeRoutines.Remove(controller);
        }
    }
}`,
  },
  {
    id: 'arrow-penetration',
    fileName: 'ArrowPenetration.cs',
    className: 'ArrowPenetration : MonoBehaviour',
    roleSummary:
      'Calculates kinetic projectile penetration depth across Wood, Stone, and Iron/Metal using reverse-ray thickness probing—piercing thin wooden shields while lodging or ricocheting in stone and iron.',
    keyHighlights: [
      'Measures exact target collider thickness along the arrow velocity vector via collider.Raycast reverse exit probing',
      'Evaluates kinetic energy * cos(incidenceAngle) against Wood, Stone, and Iron resistance to compute penetration depth in meters',
      'Supports full pass-through (with damped exit velocity & damage retention), material-depth sticking, and acute-angle Stone/Iron ricochet',
    ],
    code: `using System;
using UnityEngine;

namespace MetaQuestArchery
{
    public enum PenetrationOutcomeType
    {
        StuckInMaterial = 0,
        PassedThrough = 1,
        Ricochet = 2
    }

    public struct PenetrationOutcome
    {
        public PenetrationOutcomeType outcomeType;
        public float embedDepthMeters;
        public float measuredThicknessMeters;
        public Vector3 exitPoint;
        public Vector3 residualVelocity;
        public float damageRetention;
    }

    [Serializable]
    public struct MaterialPenetrationProfile
    {
        [Tooltip("Kinetic energy required per meter of thickness (Wood ~185, Stone ~950, Iron ~1400)")]
        public float resistancePerMeter;
        [Tooltip("Maximum physical depth (m) the arrow shaft can lodge before stopping")]
        public float maxEmbedDepthMeters;
        [Tooltip("Minimum incidence Dot(dir, -normal) required to bite instead of ricochet")]
        [Range(0f, 0.8f)] public float minBiteIncidenceDot;
        [Tooltip("Can high-velocity arrows pass completely through thin slabs of this material?")]
        public bool allowPassThrough;
        [Tooltip("Velocity retained after exiting through a thin barrier")]
        [Range(0.1f, 0.95f)] public float passThroughVelocityRetention;
    }

    /// <summary>
    /// Optional component placed on shields/walls/armor to explicitly define material
    /// hardness and optional thickness override (e.g., 0.05m thin pine buckler).
    /// </summary>
    public class PenetrableSurfaceOverride : MonoBehaviour
    {
        public SurfaceMaterialType surfaceMaterial = SurfaceMaterialType.Wood;
        [Tooltip("Leave <= 0 to auto-measure collider thickness via reverse raycast")]
        public float thicknessOverrideMeters = -1f;
        [Range(0.25f, 3f)] public float hardnessMultiplier = 1f;
    }

    /// <summary>
    /// Calculates realistic material-based penetration depth for arrows:
    /// high-energy shots pierce thin wooden shields while embedding shallowly or ricocheting off stone and iron.
    /// </summary>
    public class ArrowPenetration : MonoBehaviour
    {
        public static ArrowPenetration Instance { get; private set; }

        [Header("Material Resistance Tuning")]
        [SerializeField] private MaterialPenetrationProfile woodProfile = new MaterialPenetrationProfile
        {
            resistancePerMeter = 185f,
            maxEmbedDepthMeters = 0.24f,
            minBiteIncidenceDot = 0.14f,
            allowPassThrough = true,
            passThroughVelocityRetention = 0.72f
        };

        [SerializeField] private MaterialPenetrationProfile stoneProfile = new MaterialPenetrationProfile
        {
            resistancePerMeter = 960f,
            maxEmbedDepthMeters = 0.055f,
            minBiteIncidenceDot = 0.36f,
            allowPassThrough = false,
            passThroughVelocityRetention = 0.25f
        };

        [SerializeField] private MaterialPenetrationProfile ironMetalProfile = new MaterialPenetrationProfile
        {
            resistancePerMeter = 1420f,
            maxEmbedDepthMeters = 0.04f,
            minBiteIncidenceDot = 0.42f,
            allowPassThrough = false,
            passThroughVelocityRetention = 0.20f
        };

        [Header("Thickness Probe Settings")]
        [SerializeField] private float maxThicknessProbeMeters = 1.6f;
        [SerializeField] private float kineticScaleFactor = 1.0f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
        }

        private void OnDisable()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Convenience helper usable even if no ArrowPenetration scene singleton has been placed yet.
        /// </summary>
        public static PenetrationOutcome EvaluateStaticOrInstance(
            RaycastHit hit,
            Vector3 incomingVelocity,
            float arrowMassKg,
            float piercingMultiplier = 1f)
        {
            if (Instance != null)
            {
                return Instance.EvaluateImpact(hit, incomingVelocity, arrowMassKg, piercingMultiplier);
            }

            // Fallback evaluation using default Wood / Stone / Iron constants
            return EvaluateWithProfiles(
                hit,
                incomingVelocity,
                arrowMassKg,
                piercingMultiplier,
                1.6f,
                1.0f,
                new MaterialPenetrationProfile { resistancePerMeter = 185f, maxEmbedDepthMeters = 0.24f, minBiteIncidenceDot = 0.14f, allowPassThrough = true, passThroughVelocityRetention = 0.72f },
                new MaterialPenetrationProfile { resistancePerMeter = 960f, maxEmbedDepthMeters = 0.055f, minBiteIncidenceDot = 0.36f, allowPassThrough = false, passThroughVelocityRetention = 0.25f },
                new MaterialPenetrationProfile { resistancePerMeter = 1420f, maxEmbedDepthMeters = 0.04f, minBiteIncidenceDot = 0.42f, allowPassThrough = false, passThroughVelocityRetention = 0.20f }
            );
        }

        public PenetrationOutcome EvaluateImpact(
            RaycastHit entryHit,
            Vector3 incomingVelocity,
            float arrowMassKg,
            float piercingMultiplier = 1f)
        {
            return EvaluateWithProfiles(
                entryHit,
                incomingVelocity,
                arrowMassKg,
                piercingMultiplier,
                maxThicknessProbeMeters,
                kineticScaleFactor,
                woodProfile,
                stoneProfile,
                ironMetalProfile
            );
        }

        private static PenetrationOutcome EvaluateWithProfiles(
            RaycastHit entryHit,
            Vector3 incomingVelocity,
            float arrowMassKg,
            float piercingMultiplier,
            float maxProbeDist,
            float kineticScale,
            MaterialPenetrationProfile wood,
            MaterialPenetrationProfile stone,
            MaterialPenetrationProfile metal)
        {
            float speed = incomingVelocity.magnitude;
            Vector3 dir = speed > 0.001f ? incomingVelocity / speed : Vector3.forward;

            // 1. Resolve Material Type & Optional Thickness Override
            SurfaceMaterialType material = SurfaceMaterialType.Wood;
            float thicknessOverride = -1f;
            float hardnessScale = 1f;

            if (entryHit.collider != null)
            {
                PenetrableSurfaceOverride penOverride = entryHit.collider.GetComponentInParent<PenetrableSurfaceOverride>();
                if (penOverride != null)
                {
                    material = penOverride.surfaceMaterial;
                    thicknessOverride = penOverride.thicknessOverrideMeters;
                    hardnessScale = Mathf.Max(0.25f, penOverride.hardnessMultiplier);
                }
                else
                {
                    SurfaceMaterialTag tag = entryHit.collider.GetComponentInParent<SurfaceMaterialTag>();
                    if (tag != null) material = tag.materialType;
                }
            }

            MaterialPenetrationProfile profile = material switch
            {
                SurfaceMaterialType.Stone => stone,
                SurfaceMaterialType.Metal => metal,
                _ => wood
            };

            // 2. Check Grazing Angle Ricochet (Stone boulders & Iron shields/armor glance off at shallow angles)
            float incidenceDot = Mathf.Clamp01(Vector3.Dot(dir, -entryHit.normal));
            if (incidenceDot < profile.minBiteIncidenceDot)
            {
                Vector3 reflected = Vector3.Reflect(incomingVelocity, entryHit.normal) * 0.38f;
                return new PenetrationOutcome
                {
                    outcomeType = PenetrationOutcomeType.Ricochet,
                    embedDepthMeters = 0f,
                    measuredThicknessMeters = 0f,
                    exitPoint = entryHit.point,
                    residualVelocity = reflected,
                    damageRetention = 0.1f
                };
            }

            // 3. Calculate Effective Kinetic Penetration Capacity (Meters)
            float kineticEnergy = 0.5f * Mathf.Max(0.02f, arrowMassKg) * speed * speed;
            float effectivePower = kineticEnergy * Mathf.Lerp(0.35f, 1.15f, incidenceDot) * Mathf.Max(0.4f, piercingMultiplier) * kineticScale;
            float effectiveResistance = Mathf.Max(50f, profile.resistancePerMeter * hardnessScale);
            float capacityMeters = effectivePower / effectiveResistance;

            // 4. Measure Physical Barrier Thickness Along Trajectory via Reverse Raycast
            float thicknessMeters = thicknessOverride > 0f
                ? thicknessOverride
                : MeasureColliderThickness(entryHit, dir, maxProbeDist, out Vector3 exitPt);

            Vector3 computedExit = thicknessOverride > 0f
                ? entryHit.point + dir * thicknessOverride
                : exitPt;

            // 5. Decide: Pass Through Thin Wood vs Stick Into Heavy Material
            if (profile.allowPassThrough && thicknessMeters > 0.005f && capacityMeters > thicknessMeters)
            {
                float energyUsedFraction = Mathf.Clamp01(thicknessMeters / Mathf.Max(0.01f, capacityMeters));
                float speedScale = Mathf.Sqrt(1f - energyUsedFraction * 0.65f) * profile.passThroughVelocityRetention;

                return new PenetrationOutcome
                {
                    outcomeType = PenetrationOutcomeType.PassedThrough,
                    embedDepthMeters = thicknessMeters,
                    measuredThicknessMeters = thicknessMeters,
                    exitPoint = computedExit,
                    residualVelocity = incomingVelocity * Mathf.Max(0.28f, speedScale),
                    damageRetention = Mathf.Clamp(1f - energyUsedFraction * 0.45f, 0.45f, 0.92f)
                };
            }

            // Stuck inside heavier Stone / Iron / thick Wood
            float stuckDepth = Mathf.Clamp(capacityMeters, 0.025f, profile.maxEmbedDepthMeters);
            return new PenetrationOutcome
            {
                outcomeType = PenetrationOutcomeType.StuckInMaterial,
                embedDepthMeters = stuckDepth,
                measuredThicknessMeters = thicknessMeters,
                exitPoint = entryHit.point + dir * stuckDepth,
                residualVelocity = Vector3.zero,
                damageRetention = 1f
            };
        }

        private static float MeasureColliderThickness(
            RaycastHit entryHit,
            Vector3 dir,
            float maxProbeDist,
            out Vector3 exitPoint)
        {
            if (entryHit.collider == null)
            {
                exitPoint = entryHit.point + dir * maxProbeDist;
                return maxProbeDist;
            }

            // Cast backward from far side toward entryHit.point against ONLY this collider
            Vector3 probeStart = entryHit.point + dir * maxProbeDist;
            Ray reverseRay = new Ray(probeStart, -dir);

            if (entryHit.collider.Raycast(reverseRay, out RaycastHit backHit, maxProbeDist))
            {
                exitPoint = backHit.point;
                return Mathf.Max(0.01f, Vector3.Distance(entryHit.point, backHit.point));
            }

            exitPoint = entryHit.point + dir * maxProbeDist;
            return maxProbeDist;
        }
    }
}`,
  },
  {
    id: 'wind-effect-controller',
    fileName: 'WindEffectController.cs',
    className: 'WindEffectController : MonoBehaviour',
    roleSummary:
      'Applies flight-time-scaled directional wind force vectors to airborne arrow Rigidbodies and computes close-range full-force kinetic damage multipliers so nearest enemies suffer maximum impact damage.',
    keyHighlights: [
      'Calculates windForce = windDir * windSpeedMs * flightTimeCurve.Evaluate(flightTime) and applies it to arrow Rigidbodies via AddForce(ForceMode.Force)',
      'Tracks optional dynamic crosswind gusts (Sin + Perlin turbulence) synced with the 5 Seasons survival atmosphere',
      'Evaluates proximity kinetic force so full-draw hits on nearest enemies (<= 10m) deal up to 1.45x peak kinetic damage before air drag or wind sap arrow energy',
    ],
    code: `using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    /// <summary>
    /// Controls battlefield wind vectors acting on airborne arrow Rigidbodies (scaling force with flight time)
    /// and rewards full-force close-range shots on nearest enemies with higher kinetic damage.
    /// </summary>
    public class WindEffectController : MonoBehaviour
    {
        public static WindEffectController Instance { get; private set; }

        [Header("Wind Vector Configuration")]
        [Tooltip("World-space wind travel direction (auto-normalized)")]
        [SerializeField] private Vector3 windDirection = Vector3.right;
        [Tooltip("Base wind speed in m/s")]
        [Range(0f, 18f)]
        [SerializeField] private float windSpeedMs = 4.5f;
        [Tooltip("Aerodynamic force gain applied per (m/s) of crosswind")]
        [SerializeField] private float forceCoefficient = 0.085f;

        [Header("Flight-Time Scaling & Gusts")]
        [Tooltip("Scales wind force as arrow flightTime increases (close shots barely drift; long shots curve strongly)")]
        [SerializeField] private AnimationCurve flightTimeScaleCurve = new AnimationCurve(
            new Keyframe(0.0f, 0.20f),
            new Keyframe(0.35f, 0.75f),
            new Keyframe(1.0f, 1.45f),
            new Keyframe(2.5f, 2.25f)
        );
        [SerializeField] private bool enableTurbulenceGusts = true;
        [SerializeField] private float gustAmplitudeMs = 1.4f;
        [SerializeField] private float gustFrequencyHz = 0.28f;

        [Header("Nearest Enemy Full-Force Kinetic Damage")]
        [Tooltip("Enemies within this close range suffer maximum kinetic force damage")]
        [SerializeField] private float pointBlankRadiusMeters = 3.5f;
        [Tooltip("Distance at which kinetic close-force bonus tapers back down to 1.0x")]
        [SerializeField] private float fullForceFalloffEndMeters = 12.0f;
        [Tooltip("Peak damage multiplier when hitting a nearby enemy with a full-force draw")]
        [Range(1.0f, 2.0f)]
        [SerializeField] private float maxCloseForceMultiplier = 1.45f;

        private readonly Dictionary<Rigidbody, float> _trackedArrows = new Dictionary<Rigidbody, float>(32);
        private readonly List<Rigidbody> _staleBuffer = new List<Rigidbody>(8);

        public Vector3 CurrentWindVector
        {
            get
            {
                Vector3 dir = windDirection.sqrMagnitude > 0.0001f ? windDirection.normalized : Vector3.right;
                float gust = enableTurbulenceGusts
                    ? (Mathf.PerlinNoise(Time.time * gustFrequencyHz, 0.37f) * 2f - 1f) * gustAmplitudeMs
                    : 0f;
                return dir * Mathf.Max(0f, windSpeedMs + gust);
            }
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
        }

        private void OnDisable()
        {
            _trackedArrows.Clear();
            if (Instance == this) Instance = null;
        }

        public void SetWindParameters(Vector3 direction, float speedMs)
        {
            windDirection = direction.sqrMagnitude > 0.0001f ? direction.normalized : Vector3.right;
            windSpeedMs = Mathf.Max(0f, speedMs);
        }

        /// <summary>
        /// Optional registration if you want WindEffectController to step wind on tracked Rigidbodies automatically.
        /// </summary>
        public void RegisterAirborneArrow(Rigidbody arrowRb)
        {
            if (arrowRb != null) _trackedArrows[arrowRb] = 0f;
        }

        public void UnregisterAirborneArrow(Rigidbody arrowRb)
        {
            if (arrowRb != null) _trackedArrows.Remove(arrowRb);
        }

        private void FixedUpdate()
        {
            if (_trackedArrows.Count == 0) return;

            _staleBuffer.Clear();
            foreach (KeyValuePair<Rigidbody, float> kvp in _trackedArrows)
            {
                Rigidbody rb = kvp.Key;
                if (rb == null || rb.isKinematic)
                {
                    _staleBuffer.Add(rb);
                    continue;
                }

                float nextFlightTime = kvp.Value + Time.fixedDeltaTime;
                ApplyFlightWindForce(rb, nextFlightTime);
            }

            for (int i = 0; i < _staleBuffer.Count; i++)
            {
                _trackedArrows.Remove(_staleBuffer[i]);
            }
        }

        /// <summary>
        /// Applies a directional wind force vector to an in-flight arrow's Rigidbody,
        /// scaled smoothly with elapsed flightTime.
        /// </summary>
        public void ApplyFlightWindForce(Rigidbody arrowRb, float flightTime, float drawTensionScale = 1f)
        {
            if (arrowRb == null || arrowRb.isKinematic) return;

            Vector3 windVel = CurrentWindVector;
            if (windVel.sqrMagnitude <= 0.0001f) return;

            float timeMultiplier = Mathf.Max(0.1f, flightTimeScaleCurve.Evaluate(Mathf.Max(0f, flightTime)));
            float areaDragFactor = Mathf.Lerp(1.1f, 0.88f, Mathf.Clamp01(drawTensionScale));

            Vector3 windForce = windVel * (forceCoefficient * timeMultiplier * areaDragFactor * arrowRb.mass * 10f);
            arrowRb.AddForce(windForce, ForceMode.Force);
        }

        /// <summary>
        /// Computes higher damage for full-force arrows hitting the nearest enemies before wind & drag bleed velocity.
        /// Full-draw hits inside fullForceFalloffEndMeters deal up to maxCloseForceMultiplier (1.45x).
        /// </summary>
        public float EvaluateProximityForceMultiplier(
            float impactDistanceMeters,
            float impactSpeedMs,
            float nominalMuzzleVelocityMs,
            float drawTensionAtLaunch)
        {
            float distT = Mathf.InverseLerp(fullForceFalloffEndMeters, pointBlankRadiusMeters, impactDistanceMeters);
            float forceRatio = Mathf.Clamp01(impactSpeedMs / Mathf.Max(1f, nominalMuzzleVelocityMs));
            float fullDrawWeight = Mathf.Clamp01((drawTensionAtLaunch - 0.35f) / 0.65f);

            // Nearest enemy hit with strong draw speed retains peak kinetic force bonus
            float kineticBonusFactor = distT * Mathf.Lerp(0.55f, 1.0f, forceRatio) * Mathf.Lerp(0.45f, 1.0f, fullDrawWeight);
            return Mathf.Lerp(1.0f, maxCloseForceMultiplier, kineticBonusFactor);
        }
    }
}`,
  },
  {
    id: 'hitbox-multiplier',
    fileName: 'HitboxMultiplier.cs',
    className: 'HitboxMultiplier : MonoBehaviour',
    roleSummary:
      'Enemy prefab component evaluating Unity raycast collision tags (Headshot = 2.5x, Limb = 0.5x, Armor = 0.25x, Torso = 1.0x, Shield = 0.0x) to scale incoming arrow damage.',
    keyHighlights: [
      'Reads hit.collider.tag directly from Physics.Raycast hits on enemy child colliders via O(1) dictionary lookup',
      'Inspector-configurable TagMultiplierRule table pre-populated with Headshot (2.5x), Limb (0.5x), Armor (0.25x), Torso (1.0x), and Shield (0.0x)',
      'Implements IArrowHittable on the enemy prefab root and routes final damage + HitboxZoneType cleanly to ArmoredEnemyAI',
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    [Serializable]
    public struct TagDamageRule
    {
        [Tooltip("Unity Collider Tag assigned to child bone/mesh colliders on this enemy prefab")]
        public string colliderTag;
        [Tooltip("Damage multiplier applied when a raycast arrow strikes this tag")]
        [Min(0f)] public float damageMultiplier;
        [Tooltip("Mapped logical zone forwarded to ArmoredEnemyAI stagger/slow/kill reactions")]
        public HitboxZoneType mappedZone;
    }

    /// <summary>
    /// Attach directly to enemy prefab roots. Applies damage modifiers based on
    /// Physics.Raycast hit.collider.tag (e.g., Headshot = 2.5x, Limb = 0.5x, Armor = 0.25x).
    /// </summary>
    public class HitboxMultiplier : MonoBehaviour, IArrowHittable
    {
        [Header("Target AI Receiver")]
        [SerializeField] private ArmoredEnemyAI enemyAI;

        [Header("Tag-to-Multiplier Rules")]
        [SerializeField] private List<TagDamageRule> tagRules = new List<TagDamageRule>
        {
            new TagDamageRule { colliderTag = "Headshot", damageMultiplier = 2.50f, mappedZone = HitboxZoneType.Head },
            new TagDamageRule { colliderTag = "Torso",    damageMultiplier = 1.00f, mappedZone = HitboxZoneType.Torso },
            new TagDamageRule { colliderTag = "Limb",     damageMultiplier = 0.50f, mappedZone = HitboxZoneType.Limb },
            new TagDamageRule { colliderTag = "Armor",    damageMultiplier = 0.25f, mappedZone = HitboxZoneType.Torso },
            new TagDamageRule { colliderTag = "Shield",   damageMultiplier = 0.00f, mappedZone = HitboxZoneType.Shield }
        };

        [SerializeField] private float untaggedFallbackMultiplier = 1.0f;

        private readonly Dictionary<string, TagDamageRule> _lookup =
            new Dictionary<string, TagDamageRule>(StringComparer.OrdinalIgnoreCase);

        public Transform TargetTransform => transform;

        private void Awake()
        {
            if (enemyAI == null)
            {
                enemyAI = GetComponent<ArmoredEnemyAI>();
            }
            RebuildLookup();
        }

        private void OnValidate()
        {
            RebuildLookup();
        }

        public void RebuildLookup()
        {
            _lookup.Clear();
            if (tagRules == null) return;

            for (int i = 0; i < tagRules.Count; i++)
            {
                TagDamageRule rule = tagRules[i];
                if (!string.IsNullOrEmpty(rule.colliderTag))
                {
                    _lookup[rule.colliderTag] = rule;
                }
            }
        }

        /// <summary>
        /// Looks up the damage modifier matching the raycast hit collider's Unity Tag.
        /// </summary>
        public float GetModifierForTag(string collisionTag, out HitboxZoneType zoneType)
        {
            if (_lookup.Count == 0) RebuildLookup();

            if (!string.IsNullOrEmpty(collisionTag) && _lookup.TryGetValue(collisionTag, out TagDamageRule rule))
            {
                zoneType = rule.mappedZone;
                return rule.damageMultiplier;
            }

            zoneType = HitboxZoneType.Torso;
            return untaggedFallbackMultiplier;
        }

        /// <summary>
        /// Computes modified damage for a given RaycastHit without mutating enemy HP.
        /// </summary>
        public float CalculateModifiedDamage(RaycastHit hit, float rawDamage, out HitboxZoneType resolvedZone, out float appliedMultiplier)
        {
            string hitTag = hit.collider != null ? hit.collider.tag : string.Empty;
            appliedMultiplier = GetModifierForTag(hitTag, out resolvedZone);
            return Mathf.Max(0f, rawDamage * appliedMultiplier);
        }

        /// <summary>
        /// Invoked automatically by VRArrowProjectile upon raycast impact against any tagged child collider.
        /// </summary>
        public void OnArrowImpact(VRArrowProjectile arrow, RaycastHit hit, float rawDamage, float scoreMultiplier)
        {
            if (enemyAI == null || enemyAI.IsDefeated) return;

            float finalDamage = CalculateModifiedDamage(hit, rawDamage, out HitboxZoneType zone, out float mult);
            if (mult <= 0.001f || zone == HitboxZoneType.Shield)
            {
                // Shield tag blocked the kinetic strike
                return;
            }

            enemyAI.ReceiveHitboxDamage(finalDamage, zone, false);
        }

        public void ApplyCryoFreeze(float speedMultiplier, float duration)
        {
            enemyAI?.ApplyCryoSlow(speedMultiplier, duration);
        }
    }
}`,
  },
  {
    id: 'quiver-manager',
    fileName: 'QuiverManager.cs',
    className: 'QuiverManager : MonoBehaviour',
    roleSummary:
      'Tracks remaining arrow counts per ArrowCategory (with wave resupply) and fires a dual-pulse Meta Quest out-of-ammo haptic alert + diegetic UI warning when trying to nock a depleted arrow.',
    keyHighlights: [
      'Maintains remaining/max ammo counts per ArrowCategory (CarbonBroadhead unlimited by default, special warheads finite)',
      'Triggers a crisp double-stutter XR haptic pulse + empty-quiver click SFX + wrist TMP_Text warning when attempting to nock 0-ammo arrows',
      'Throttles repeat out-of-ammo alerts while hand lingers near nock socket and supports per-wave resupply',
    ],
    code: `using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.XR;
using TMPro;

namespace MetaQuestArchery
{
    [Serializable]
    public class QuiverAmmoSlot
    {
        public ArrowCategory category = ArrowCategory.CarbonBroadhead;
        public int startingCount = 12;
        public int maxCapacity = 24;
        public int resupplyPerWave = 6;
        public bool unlimitedAmmo = false;

        [HideInInspector] public int currentCount;
    }

    [Serializable]
    public class QuiverDepletedEvent : UnityEvent<ArrowCategory> { }

    /// <summary>
    /// Tracks remaining arrow counts per arrow archetype and fires a distinct Meta Quest
    /// out-of-ammo haptic alert + diegetic warning when nocking an empty arrow type.
    /// </summary>
    public class QuiverManager : MonoBehaviour
    {
        public static QuiverManager Instance { get; private set; }

        [Header("Per-Type Quiver Inventory")]
        [SerializeField] private List<QuiverAmmoSlot> ammoSlots = new List<QuiverAmmoSlot>
        {
            new QuiverAmmoSlot { category = ArrowCategory.CarbonBroadhead,   startingCount = 99, maxCapacity = 99, resupplyPerWave = 99, unlimitedAmmo = true },
            new QuiverAmmoSlot { category = ArrowCategory.ThermiteDetonator, startingCount = 6,  maxCapacity = 12, resupplyPerWave = 4,  unlimitedAmmo = false },
            new QuiverAmmoSlot { category = ArrowCategory.CryoFrostShard,    startingCount = 6,  maxCapacity = 12, resupplyPerWave = 4,  unlimitedAmmo = false },
            new QuiverAmmoSlot { category = ArrowCategory.VoltArcSeeker,     startingCount = 5,  maxCapacity = 10, resupplyPerWave = 3,  unlimitedAmmo = false },
            new QuiverAmmoSlot { category = ArrowCategory.ChronoSplitVolley, startingCount = 5,  maxCapacity = 10, resupplyPerWave = 3,  unlimitedAmmo = false }
        };

        [Header("Out-of-Ammo Haptic & Audio Alert")]
        [SerializeField] private float alertCooldownSeconds = 0.45f;
        [Range(0.2f, 1f)] [SerializeField] private float emptyHapticAmplitude = 0.88f;
        [SerializeField] private float pulseDurationSeconds = 0.065f;
        [SerializeField] private float doublePulseGapSeconds = 0.07f;
        [SerializeField] private AudioSource quiverAudioSource;
        [SerializeField] private AudioClip emptyQuiverClickClip;

        [Header("Diegetic Wrist / Quiver UI")]
        [SerializeField] private TMP_Text ammoReadoutText;
        [SerializeField] private TMP_Text emptyAlertBannerText;
        [SerializeField] private float bannerVisibleSeconds = 1.4f;

        public QuiverDepletedEvent onOutOfAmmoAttempt = new QuiverDepletedEvent();

        private readonly Dictionary<ArrowCategory, QuiverAmmoSlot> _slotMap =
            new Dictionary<ArrowCategory, QuiverAmmoSlot>(8);
        private float _lastAlertTime = -10f;
        private Coroutine _alertRoutine;
        private Coroutine _bannerRoutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
            InitializeQuiver();
        }

        private void OnDisable()
        {
            if (Instance == this) Instance = null;
        }

        public void InitializeQuiver()
        {
            _slotMap.Clear();
            for (int i = 0; i < ammoSlots.Count; i++)
            {
                QuiverAmmoSlot slot = ammoSlots[i];
                slot.currentCount = slot.unlimitedAmmo
                    ? slot.maxCapacity
                    : Mathf.Clamp(slot.startingCount, 0, slot.maxCapacity);
                _slotMap[slot.category] = slot;
            }
            RefreshAmmoText(ArrowCategory.CarbonBroadhead);
        }

        public int GetRemainingCount(ArrowCategory category)
        {
            if (_slotMap.TryGetValue(category, out QuiverAmmoSlot slot))
            {
                return slot.unlimitedAmmo ? int.MaxValue : slot.currentCount;
            }
            return 0;
        }

        public bool HasAmmo(ArrowCategory category) => GetRemainingCount(category) > 0;

        /// <summary>
        /// Checks whether an arrow type can be nocked. If remaining count is 0, triggers the
        /// out-of-ammo double-pulse haptic alert and returns false.
        /// </summary>
        public bool CanNockOrTriggerAlert(ArrowCategory category, XRNode pullingHand = XRNode.RightHand)
        {
            if (HasAmmo(category))
            {
                RefreshAmmoText(category);
                return true;
            }

            TriggerOutOfAmmoAlert(category, pullingHand);
            return false;
        }

        public bool ConsumeArrow(ArrowCategory category)
        {
            if (!_slotMap.TryGetValue(category, out QuiverAmmoSlot slot)) return false;
            if (slot.unlimitedAmmo)
            {
                RefreshAmmoText(category);
                return true;
            }

            if (slot.currentCount <= 0)
            {
                TriggerOutOfAmmoAlert(category, XRNode.RightHand);
                return false;
            }

            slot.currentCount = Mathf.Max(0, slot.currentCount - 1);
            RefreshAmmoText(category);
            return true;
        }

        public void AddAmmo(ArrowCategory category, int amount)
        {
            if (_slotMap.TryGetValue(category, out QuiverAmmoSlot slot) && !slot.unlimitedAmmo)
            {
                slot.currentCount = Mathf.Clamp(slot.currentCount + Mathf.Max(0, amount), 0, slot.maxCapacity);
                RefreshAmmoText(category);
            }
        }

        public void ResupplyForNextWave()
        {
            foreach (QuiverAmmoSlot slot in _slotMap.Values)
            {
                if (!slot.unlimitedAmmo)
                {
                    slot.currentCount = Mathf.Clamp(slot.currentCount + slot.resupplyPerWave, 0, slot.maxCapacity);
                }
            }
        }

        public void TriggerOutOfAmmoAlert(ArrowCategory category, XRNode handNode)
        {
            if (Time.unscaledTime - _lastAlertTime < alertCooldownSeconds) return;
            _lastAlertTime = Time.unscaledTime;

            if (_alertRoutine != null) StopCoroutine(_alertRoutine);
            _alertRoutine = StartCoroutine(DoubleStutterHapticRoutine(handNode));

            if (quiverAudioSource != null && emptyQuiverClickClip != null)
            {
                quiverAudioSource.PlayOneShot(emptyQuiverClickClip, 0.9f);
            }

            if (emptyAlertBannerText != null)
            {
                if (_bannerRoutine != null) StopCoroutine(_bannerRoutine);
                _bannerRoutine = StartCoroutine(ShowEmptyBannerRoutine(category));
            }

            RefreshAmmoText(category);
            onOutOfAmmoAttempt?.Invoke(category);
        }

        private IEnumerator DoubleStutterHapticRoutine(XRNode handNode)
        {
            SendImpulse(handNode, emptyHapticAmplitude, pulseDurationSeconds);
            SendImpulse(XRNode.LeftHand, emptyHapticAmplitude * 0.45f, pulseDurationSeconds);
            yield return new WaitForSecondsRealtime(pulseDurationSeconds + doublePulseGapSeconds);
            SendImpulse(handNode, emptyHapticAmplitude * 0.95f, pulseDurationSeconds * 1.15f);
            _alertRoutine = null;
        }

        private IEnumerator ShowEmptyBannerRoutine(ArrowCategory category)
        {
            emptyAlertBannerText.gameObject.SetActive(true);
            emptyAlertBannerText.text = $"OUT OF {category.ToString().ToUpper()}!";
            emptyAlertBannerText.color = new Color(0.98f, 0.25f, 0.25f);
            yield return new WaitForSecondsRealtime(bannerVisibleSeconds);
            emptyAlertBannerText.gameObject.SetActive(false);
            _bannerRoutine = null;
        }

        private void RefreshAmmoText(ArrowCategory activeCategory)
        {
            if (ammoReadoutText == null || !_slotMap.TryGetValue(activeCategory, out QuiverAmmoSlot slot)) return;
            ammoReadoutText.text = slot.unlimitedAmmo ? "INF" : $"{slot.currentCount}/{slot.maxCapacity}";
            ammoReadoutText.color = (!slot.unlimitedAmmo && slot.currentCount == 0)
                ? new Color(0.98f, 0.25f, 0.25f)
                : Color.white;
        }

        private static void SendImpulse(XRNode node, float amplitude, float duration)
        {
            InputDevice device = InputDevices.GetDeviceAtXRNode(node);
            if (device.isValid && device.TryGetHapticCapabilities(out HapticCapabilities caps) && caps.supportsImpulse)
            {
                device.SendHapticImpulse(0u, Mathf.Clamp01(amplitude), duration);
            }
        }
    }
}`,
  },
  {
    id: 'projectile-trail-manager',
    fileName: 'ProjectileTrailManager.cs',
    className: 'ProjectileTrailManager : MonoBehaviour',
    roleSummary:
      'Dynamically spawns typed particle emitters (Thermite embers, Cryo frost mist, Volt sparks, Chrono slipstream) onto an arrow tail in flight and gracefully detaches + destroys them upon impact.',
    keyHighlights: [
      'Maps ArrowCategory to custom ParticleSystem tail prefabs or generates procedural world-space ParticleSystem trails automatically',
      'Keeps in-flight trails anchored cleanly at nockTransform in World simulation space so embers/mist linger behind the moving shaft',
      'On impact, detaches the emitter, stops new emissions (StopEmitting), and automatically destroys/cleans up particle GameObjects once remaining particles expire',
    ],
    code: `using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    [Serializable]
    public struct ArrowTailTrailProfile
    {
        public ArrowCategory category;
        [Tooltip("Optional custom ParticleSystem prefab; if null, a procedural typed emitter is built automatically")]
        public ParticleSystem customTrailPrefab;
        public Color startColor;
        public Color endColor;
        [Range(8f, 160f)] public float emissionRateOverTime;
        [Range(0.02f, 0.25f)] public float particleSize;
        [Range(0.15f, 1.8f)] public float particleLifetime;
        public float gravityModifier;
    }

    /// <summary>
    /// Spawns arrow-type-specific particle trails (embers for fire, frost mist for ice,
    /// electric sparks for shock) on airborne arrow tails and auto-cleans them upon impact.
    /// </summary>
    public class ProjectileTrailManager : MonoBehaviour
    {
        public static ProjectileTrailManager Instance { get; private set; }

        [Header("Arrow Tail Particle Profiles")]
        [SerializeField] private List<ArrowTailTrailProfile> trailProfiles = new List<ArrowTailTrailProfile>
        {
            new ArrowTailTrailProfile
            {
                category = ArrowCategory.CarbonBroadhead,
                startColor = new Color(0.75f, 0.90f, 1.0f, 0.45f),
                endColor = new Color(0.50f, 0.70f, 0.90f, 0.0f),
                emissionRateOverTime = 24f,
                particleSize = 0.035f,
                particleLifetime = 0.28f,
                gravityModifier = 0f
            },
            new ArrowTailTrailProfile
            {
                category = ArrowCategory.ThermiteDetonator, // Glowing Fire Embers
                startColor = new Color(1.0f, 0.48f, 0.08f, 0.95f),
                endColor = new Color(0.85f, 0.12f, 0.02f, 0.0f),
                emissionRateOverTime = 78f,
                particleSize = 0.065f,
                particleLifetime = 0.58f,
                gravityModifier = 0.18f
            },
            new ArrowTailTrailProfile
            {
                category = ArrowCategory.CryoFrostShard, // Swirling Frost Mist
                startColor = new Color(0.45f, 0.94f, 1.0f, 0.72f),
                endColor = new Color(0.82f, 0.98f, 1.0f, 0.0f),
                emissionRateOverTime = 64f,
                particleSize = 0.11f,
                particleLifetime = 0.72f,
                gravityModifier = -0.05f
            },
            new ArrowTailTrailProfile
            {
                category = ArrowCategory.VoltArcSeeker, // High-Voltage Shock Sparks
                startColor = new Color(0.78f, 0.45f, 1.0f, 1.0f),
                endColor = new Color(0.25f, 0.85f, 1.0f, 0.0f),
                emissionRateOverTime = 95f,
                particleSize = 0.045f,
                particleLifetime = 0.24f,
                gravityModifier = 0.08f
            },
            new ArrowTailTrailProfile
            {
                category = ArrowCategory.ChronoSplitVolley, // Emerald Slipstream
                startColor = new Color(0.18f, 0.92f, 0.62f, 0.85f),
                endColor = new Color(0.08f, 0.65f, 0.45f, 0.0f),
                emissionRateOverTime = 56f,
                particleSize = 0.055f,
                particleLifetime = 0.36f,
                gravityModifier = 0f
            }
        };

        [Header("Cleanup Safety")]
        [SerializeField] private float fallbackCleanupDelay = 1.5f;

        private readonly Dictionary<ArrowCategory, ArrowTailTrailProfile> _profileMap =
            new Dictionary<ArrowCategory, ArrowTailTrailProfile>(8);
        private readonly Dictionary<Transform, ParticleSystem> _activeTailParticles =
            new Dictionary<Transform, ParticleSystem>(32);

        private Material _runtimeParticleMaterial;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(this);
                return;
            }
            Instance = this;
            RebuildProfileMap();
        }

        private void OnDisable()
        {
            _activeTailParticles.Clear();
            if (Instance == this) Instance = null;
        }

        private void RebuildProfileMap()
        {
            _profileMap.Clear();
            for (int i = 0; i < trailProfiles.Count; i++)
            {
                _profileMap[trailProfiles[i].category] = trailProfiles[i];
            }
        }

        /// <summary>
        /// Spawns and parents the matching arrow-type particle system to the arrow's tail anchor.
        /// </summary>
        public ParticleSystem AttachTrailToArrow(Transform tailAnchor, ArrowCategory category)
        {
            if (tailAnchor == null) return null;

            // Clean up any stale trail on the same anchor if reused/pooled
            if (_activeTailParticles.TryGetValue(tailAnchor, out ParticleSystem existing) && existing != null)
            {
                Destroy(existing.gameObject);
                _activeTailParticles.Remove(tailAnchor);
            }

            if (!_profileMap.TryGetValue(category, out ArrowTailTrailProfile profile))
            {
                profile = trailProfiles[0];
            }

            ParticleSystem ps;
            if (profile.customTrailPrefab != null)
            {
                ps = Instantiate(profile.customTrailPrefab, tailAnchor.position, tailAnchor.rotation, tailAnchor);
            }
            else
            {
                ps = CreateProceduralTrailSystem(tailAnchor, profile, category);
            }

            ps.Play(true);
            _activeTailParticles[tailAnchor] = ps;
            return ps;
        }

        /// <summary>
        /// Stops particle emission upon arrow impact, detaches particles into world space so
        /// existing embers/mist fade smoothly, and automatically destroys the emitter afterward.
        /// </summary>
        public void ReleaseTrailOnImpact(Transform tailAnchor)
        {
            if (tailAnchor == null) return;
            if (!_activeTailParticles.TryGetValue(tailAnchor, out ParticleSystem ps)) return;

            _activeTailParticles.Remove(tailAnchor);
            if (ps == null) return;

            ps.transform.SetParent(null, true);
            ps.Stop(true, ParticleSystemStopBehavior.StopEmitting);

            float waitSeconds = ps.main.startLifetime.constantMax > 0f
                ? ps.main.startLifetime.constantMax + 0.25f
                : fallbackCleanupDelay;

            StartCoroutine(DestroyTrailAfterFadeRoutine(ps.gameObject, waitSeconds));
        }

        private IEnumerator DestroyTrailAfterFadeRoutine(GameObject trailObject, float delay)
        {
            yield return new WaitForSeconds(delay);
            if (trailObject != null)
            {
                Destroy(trailObject);
            }
        }

        private ParticleSystem CreateProceduralTrailSystem(
            Transform parentAnchor,
            ArrowTailTrailProfile profile,
            ArrowCategory category)
        {
            GameObject go = new GameObject($"Trail_{category}");
            go.transform.SetParent(parentAnchor, false);
            go.transform.localPosition = Vector3.zero;
            go.transform.localRotation = Quaternion.identity;

            ParticleSystem ps = go.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = ps.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startLifetime = profile.particleLifetime;
            main.startSpeed = category == ArrowCategory.VoltArcSeeker ? 1.8f : 0.45f;
            main.startSize = profile.particleSize;
            main.startColor = profile.startColor;
            main.gravityModifier = profile.gravityModifier;
            main.maxParticles = 160;
            main.playOnAwake = false;

            ParticleSystem.EmissionModule emission = ps.emission;
            emission.rateOverTime = profile.emissionRateOverTime;

            ParticleSystem.ShapeModule shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = category == ArrowCategory.CryoFrostShard ? 24f : 12f;
            shape.radius = 0.015f;

            ParticleSystem.ColorOverLifetimeModule colLife = ps.colorOverLifetime;
            colLife.enabled = true;
            Gradient grad = new Gradient();
            grad.SetKeys(
                new[] { new GradientColorKey(profile.startColor, 0f), new GradientColorKey(profile.endColor, 1f) },
                new[] { new GradientAlphaKey(profile.startColor.a, 0f), new GradientAlphaKey(0f, 1f) }
            );
            colLife.color = new ParticleSystem.MinMaxGradient(grad);

            ParticleSystemRenderer renderer = go.GetComponent<ParticleSystemRenderer>();
            if (renderer != null)
            {
                if (_runtimeParticleMaterial == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Particles/Unlit") ?? Shader.Find("Particles/Standard Unlit");
                    _runtimeParticleMaterial = new Material(shader);
                }
                renderer.sharedMaterial = _runtimeParticleMaterial;
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }

            return ps;
        }
    }
}`,
  },
  {
    id: 'vr-smooth-locomotion',
    fileName: 'VRSmoothLocomotion.cs',
    className: 'VRSmoothLocomotion : MonoBehaviour',
    roleSummary:
      'Maps Meta Quest Left Thumbstick to head-oriented CharacterController translation (walk/sprint) and Right Thumbstick to comfort Snap Turn or Smooth Turn pivoted accurately around the HMD.',
    keyHighlights: [
      'Translates CharacterController along flattened Head (HMD) or Hand forward/right vectors with deadzone, sprint click, and gravity grounding',
      'Supports TurnComfortMode.SnapTurn (45-deg default with deadzone re-arm & cooldown) and TurnComfortMode.SmoothTurn pivoted around headCamera.position',
      'Fades an optional peripheral VR comfort vignette during motion/turns to prevent cybersickness on Meta Quest',
    ],
    code: `using UnityEngine;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    public enum TurnComfortMode
    {
        SnapTurn = 0,
        SmoothTurn = 1
    }

    public enum LocomotionForwardSource
    {
        HeadGaze = 0,
        LeftController = 1
    }

    /// <summary>
    /// Meta Quest XR Locomotion script mapping Left Thumbstick to CharacterController translation
    /// and Right Thumbstick to Snap Turn or Smooth Turn around the user's HMD head pivot.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class VRSmoothLocomotion : MonoBehaviour
    {
        [Header("XR Rig & Direction Reference")]
        [SerializeField] private Transform headCameraTransform;
        [SerializeField] private Transform leftControllerTransform;
        [SerializeField] private LocomotionForwardSource forwardSource = LocomotionForwardSource.HeadGaze;

        [Header("Smooth Translation Settings")]
        [SerializeField] private float walkSpeed = 4.2f;
        [SerializeField] private float sprintSpeed = 7.4f;
        [SerializeField] private float acceleration = 14f;
        [SerializeField] private float gravity = -16f;
        [Range(0.05f, 0.35f)]
        [SerializeField] private float moveDeadzone = 0.16f;

        [Header("Snap Turn & Comfort Turning")]
        [SerializeField] private TurnComfortMode turnMode = TurnComfortMode.SnapTurn;
        [Range(15f, 90f)]
        [SerializeField] private float snapTurnAngleDegrees = 45f;
        [Range(0.45f, 0.9f)]
        [SerializeField] private float snapStickThreshold = 0.62f;
        [SerializeField] private float snapResetThreshold = 0.25f;
        [SerializeField] private float snapCooldownSeconds = 0.26f;
        [SerializeField] private float smoothTurnSpeedDegPerSec = 110f;

        [Header("Optional Comfort Tunnel Vignette")]
        [SerializeField] private CanvasGroup comfortVignette;
        [Range(0f, 0.85f)]
        [SerializeField] private float maxMovingVignetteAlpha = 0.32f;

        private CharacterController _controller;
        private Vector3 _horizontalVelocity;
        private float _verticalVelocity;
        private bool _snapTurnArmed = true;
        private float _lastSnapTime = -5f;

        public TurnComfortMode CurrentTurnMode => turnMode;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            InputDevice leftHand = InputDevices.GetDeviceAtXRNode(XRNode.LeftHand);
            InputDevice rightHand = InputDevices.GetDeviceAtXRNode(XRNode.RightHand);

            float moveMag = ProcessSmoothTranslation(leftHand);
            bool didTurn = ProcessRotation(rightHand);
            UpdateComfortVignette(moveMag, didTurn);
        }

        public void SetTurnComfortMode(TurnComfortMode newMode)
        {
            turnMode = newMode;
        }

        public void SetSnapAngle(float angleDegrees)
        {
            snapTurnAngleDegrees = Mathf.Clamp(angleDegrees, 15f, 90f);
        }

        private float ProcessSmoothTranslation(InputDevice leftHand)
        {
            Vector2 stick = Vector2.zero;
            bool sprintClick = false;

            if (leftHand.isValid)
            {
                leftHand.TryGetFeatureValue(CommonUsages.primary2DAxis, out stick);
                leftHand.TryGetFeatureValue(CommonUsages.primary2DAxisClick, out sprintClick);
            }

            Vector3 desiredHoriz = Vector3.zero;
            float inputMagnitude = stick.magnitude;

            if (inputMagnitude > moveDeadzone)
            {
                float remappedMag = Mathf.InverseLerp(moveDeadzone, 1f, Mathf.Min(1f, inputMagnitude));
                Vector2 dir2D = stick / inputMagnitude;

                Transform basis = (forwardSource == LocomotionForwardSource.LeftController && leftControllerTransform != null)
                    ? leftControllerTransform
                    : headCameraTransform;

                Vector3 fwd = basis != null ? basis.forward : transform.forward;
                Vector3 right = basis != null ? basis.right : transform.right;
                fwd.y = 0f;
                right.y = 0f;
                fwd.Normalize();
                right.Normalize();

                float activeSpeed = sprintClick ? sprintSpeed : walkSpeed;
                desiredHoriz = (fwd * dir2D.y + right * dir2D.x) * (activeSpeed * remappedMag);
            }

            _horizontalVelocity = Vector3.Lerp(_horizontalVelocity, desiredHoriz, 1f - Mathf.Exp(-acceleration * Time.deltaTime));

            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = -1.5f;
            }
            _verticalVelocity += gravity * Time.deltaTime;

            Vector3 frameMove = _horizontalVelocity + Vector3.up * _verticalVelocity;
            _controller.Move(frameMove * Time.deltaTime);

            return inputMagnitude > moveDeadzone ? inputMagnitude : 0f;
        }

        private bool ProcessRotation(InputDevice rightHand)
        {
            if (!rightHand.isValid || !rightHand.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 stick))
            {
                _snapTurnArmed = true;
                return false;
            }

            if (turnMode == TurnComfortMode.SnapTurn)
            {
                if (Mathf.Abs(stick.x) < snapResetThreshold)
                {
                    _snapTurnArmed = true;
                }
                else if (_snapTurnArmed && Mathf.Abs(stick.x) >= snapStickThreshold && Time.unscaledTime - _lastSnapTime >= snapCooldownSeconds)
                {
                    _snapTurnArmed = false;
                    _lastSnapTime = Time.unscaledTime;

                    float yawDelta = Mathf.Sign(stick.x) * snapTurnAngleDegrees;
                    RotateRigAroundHeadPivot(yawDelta);
                    return true;
                }
                return false;
            }
            else
            {
                if (Mathf.Abs(stick.x) > moveDeadzone)
                {
                    float yawDelta = stick.x * smoothTurnSpeedDegPerSec * Time.deltaTime;
                    RotateRigAroundHeadPivot(yawDelta);
                    return true;
                }
                return false;
            }
        }

        /// <summary>
        /// Rotates the XR Rig around the user's current HMD world XZ position so snap turning
        /// never shifts the player off balance in room-scale playspaces.
        /// </summary>
        private void RotateRigAroundHeadPivot(float yawDeltaDegrees)
        {
            if (headCameraTransform != null)
            {
                transform.RotateAround(headCameraTransform.position, Vector3.up, yawDeltaDegrees);
            }
            else
            {
                transform.Rotate(0f, yawDeltaDegrees, 0f, Space.World);
            }
        }

        private void UpdateComfortVignette(float moveInputMag, bool activelyTurning)
        {
            if (comfortVignette == null) return;
            float targetAlpha = (moveInputMag > 0.1f || activelyTurning)
                ? maxMovingVignetteAlpha * Mathf.Max(moveInputMag, activelyTurning ? 0.75f : 0f)
                : 0f;
            comfortVignette.alpha = Mathf.MoveTowards(comfortVignette.alpha, targetAlpha, Time.deltaTime * 4.5f);
        }
    }
}`,
  },
  {
    id: 'dynamic-sight-controller',
    fileName: 'DynamicSightController.cs',
    className: 'DynamicSightController : MonoBehaviour',
    roleSummary:
      'Adjusts holographic bow sight reticle scale, prong convergence, and HSV color saturation/emission in real time based on VRBowController.NormalizedTension.',
    keyHighlights: [
      'Reads VRBowController.NormalizedTension every frame and contracts the sight ring smoothly from wide relaxed scale to razor-tight full-draw focus',
      'Uses Color.RGBToHSV / Color.HSVToRGB to boost reticle color saturation, alpha, and HDR emission smoothly with bow draw percentage',
      'Updates both UI Image (WorldSpace bow sight) and 3D MeshRenderer via MaterialPropertyBlock with a full-power lock pulse at >= 94% draw',
    ],
    code: `using UnityEngine;
using UnityEngine.UI;

namespace MetaQuestArchery
{
    /// <summary>
    /// Dynamically adjusts bow sight reticle scale and HSV color saturation/brightness
    /// in real time based on bow draw percentage, giving crisp visual tension feedback in VR.
    /// </summary>
    public class DynamicSightController : MonoBehaviour
    {
        [Header("Bow Tension Source")]
        [SerializeField] private VRBowController bowController;
        [SerializeField] private float tensionLerpSpeed = 18f;

        [Header("Reticle Visual Targets (UI & Optional 3D Holo Ring)")]
        [SerializeField] private RectTransform reticleRoot;
        [SerializeField] private Image reticleRingImage;
        [SerializeField] private Image centerDotImage;
        [SerializeField] private RectTransform[] convergingProngs;
        [SerializeField] private Renderer holoMeshRenderer;

        [Header("Size Contraction by Draw %")]
        [SerializeField] private float relaxedReticleScale = 1.90f;
        [SerializeField] private float fullDrawReticleScale = 0.62f;
        [SerializeField] private float prongMaxSpreadPx = 28f;
        [SerializeField] private float prongMinSpreadPx = 6f;
        [SerializeField] private AnimationCurve contractionCurve = AnimationCurve.EaseInOut(0f, 0f, 1f, 1f);

        [Header("HSV Saturation & Color Feedback")]
        [SerializeField] private Color baseSightColor = new Color(0.22f, 0.78f, 0.98f, 1f);
        [SerializeField] private Color peakPowerColor = new Color(0.98f, 0.35f, 0.20f, 1f);
        [Range(0f, 1f)] [SerializeField] private float idleSaturation = 0.18f;
        [Range(0f, 1f)] [SerializeField] private float fullDrawSaturation = 1.00f;
        [Range(0.2f, 1f)] [SerializeField] private float idleBrightness = 0.55f;
        [Range(0.2f, 1f)] [SerializeField] private float fullDrawBrightness = 1.00f;
        [Range(0.1f, 1f)] [SerializeField] private float idleAlpha = 0.35f;
        [Range(0.1f, 1f)] [SerializeField] private float fullDrawAlpha = 0.96f;

        [Header("Max-Draw Lock Pulse")]
        [SerializeField] private float fullLockThreshold = 0.94f;
        [SerializeField] private float emissionBoostMultiplier = 2.4f;

        private float _smoothedTension;
        private float? _manualTensionOverride;
        private MaterialPropertyBlock _propBlock;
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

        private void Awake()
        {
            _propBlock = new MaterialPropertyBlock();
        }

        public void SetArrowAccentColor(ArrowTypeData arrowData)
        {
            if (arrowData != null)
            {
                baseSightColor = arrowData.tipAccentColor;
            }
        }

        public void SetManualDrawTension(float normalizedTension)
        {
            _manualTensionOverride = Mathf.Clamp01(normalizedTension);
        }

        public void ClearManualOverride()
        {
            _manualTensionOverride = null;
        }

        private void Update()
        {
            float targetTension = _manualTensionOverride.HasValue
                ? _manualTensionOverride.Value
                : (bowController != null ? bowController.NormalizedTension : 0f);

            _smoothedTension = Mathf.Lerp(_smoothedTension, Mathf.Clamp01(targetTension), 1f - Mathf.Exp(-tensionLerpSpeed * Time.deltaTime));
            ApplySightVisuals(_smoothedTension);
        }

        private void ApplySightVisuals(float tension)
        {
            float curvedT = Mathf.Clamp01(contractionCurve.Evaluate(tension));

            // 1. Scale reticle ring down as bow draw tightens aim convergence
            float baseScale = Mathf.Lerp(relaxedReticleScale, fullDrawReticleScale, curvedT);
            float lockPulse = tension >= fullLockThreshold ? (1f + Mathf.Sin(Time.unscaledTime * 14f) * 0.045f) : 1f;
            if (reticleRoot != null)
            {
                reticleRoot.localScale = Vector3.one * (baseScale * lockPulse);
            }

            // Converge optional radial sight prongs inward toward center dot
            if (convergingProngs != null && convergingProngs.Length > 0)
            {
                float spread = Mathf.Lerp(prongMaxSpreadPx, prongMinSpreadPx, curvedT);
                for (int i = 0; i < convergingProngs.Length; i++)
                {
                    if (convergingProngs[i] == null) continue;
                    float angleRad = (i * (360f / convergingProngs.Length)) * Mathf.Deg2Rad;
                    convergingProngs[i].anchoredPosition = new Vector2(Mathf.Cos(angleRad), Mathf.Sin(angleRad)) * spread;
                }
            }

            // 2. Compute HSV Saturation, Value, and Hue blend for crisp tension feedback
            Color blendedHueColor = Color.Lerp(baseSightColor, peakPowerColor, Mathf.InverseLerp(0.55f, 1f, tension));
            Color.RGBToHSV(blendedHueColor, out float hue, out float _, out float _);

            float targetSat = Mathf.Lerp(idleSaturation, fullDrawSaturation, curvedT);
            float targetVal = Mathf.Lerp(idleBrightness, fullDrawBrightness, curvedT);
            Color saturatedColor = Color.HSVToRGB(hue, targetSat, targetVal);
            saturatedColor.a = Mathf.Lerp(idleAlpha, fullDrawAlpha, curvedT);

            if (reticleRingImage != null) reticleRingImage.color = saturatedColor;
            if (centerDotImage != null)
            {
                centerDotImage.color = Color.Lerp(Color.white, saturatedColor, curvedT);
            }

            // 3. Drive optional 3D holographic lens renderer without instantiating material copies
            if (holoMeshRenderer != null)
            {
                holoMeshRenderer.GetPropertyBlock(_propBlock);
                _propBlock.SetColor(BaseColorId, saturatedColor);
                float glowStrength = Mathf.Lerp(0.35f, emissionBoostMultiplier, curvedT) * lockPulse;
                _propBlock.SetColor(EmissionColorId, saturatedColor * glowStrength);
                holoMeshRenderer.SetPropertyBlock(_propBlock);
            }
        }
    }
}`,
  },
  {
    id: 'bow-scope-stabilizer',
    fileName: 'BowScopeStabilizer.cs',
    className: 'BowScopeStabilizer : MonoBehaviour',
    roleSummary:
      'Applies adaptive steady-aim rotational/positional jitter filtering to the bow sight and a subtle VR-safe breathing / focus-zoom cadence based on draw tension and player draw stability.',
    keyHighlights: [
      'Computes live DrawStability (0..1) from bowstring velocity steadiness & draw hold duration, exposing Hold-Breath boost',
      'Filters hand/controller micro-jitter on bowAimPivot dynamically without fighting OpenXR headset pose tracking',
      'Adds a subtle sinusoidal camera/bow breathe cadence and gentle focus FOV narrowing on desktop or non-locked cameras when drawn',
    ],
    code: `using UnityEngine;
using UnityEngine.XR;

namespace MetaQuestArchery
{
    /// <summary>
    /// Adds a subtle camera/sight "breathe" and steady-aim jitter damping effect when the bow
    /// is drawn, tightening aim smoothing proportionally to the player's current draw stability.
    /// </summary>
    public class BowScopeStabilizer : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private VRBowController bowController;
        [SerializeField] private Transform bowAimPivot;
        [SerializeField] private Transform swayCameraOffsetPivot;
        [SerializeField] private Camera fallbackDesktopCamera;

        [Header("Draw Stability & Fatigue")]
        [Range(0f, 1f)]
        [SerializeField] private float drawStabilityValue = 0.85f;
        [SerializeField] private float stabilityRecoveryRate = 1.6f;
        [SerializeField] private float jitterPenaltySensitivity = 3.5f;
        [SerializeField] private KeyCode desktopSteadyBreathKey = KeyCode.LeftShift;

        [Header("Steady-Aim Filtering & Breathe")]
        [SerializeField] private float minDrawThreshold = 0.15f;
        [SerializeField] private float relaxedRotSmoothing = 26f;
        [SerializeField] private float stabilizedRotSmoothing = 7.5f;
        [SerializeField] private float maxBreathePitchDeg = 0.35f;
        [SerializeField] private float maxBreatheYawDeg = 0.22f;
        [SerializeField] private float breatheCycleHz = 0.28f;

        [Header("Non-XR Focus FOV Zoom")]
        [SerializeField] private float normalDesktopFov = 68f;
        [SerializeField] private float drawnFocusFov = 59f;
        [SerializeField] private float fovLerpSpeed = 8f;

        private Quaternion _filteredAimRotation;
        private Quaternion _lastRawAimRotation;
        private float _breathePhase;
        private bool _initialized;

        public float CurrentDrawStability => drawStabilityValue;

        private void OnEnable()
        {
            if (bowAimPivot != null)
            {
                _filteredAimRotation = bowAimPivot.rotation;
                _lastRawAimRotation = bowAimPivot.rotation;
                _initialized = true;
            }
        }

        public void SetDrawStability(float stabilityNormalized)
        {
            drawStabilityValue = Mathf.Clamp01(stabilityNormalized);
        }

        private void LateUpdate()
        {
            float tension = bowController != null ? bowController.NormalizedTension : 0f;
            bool isAimingDrawn = tension >= minDrawThreshold;

            UpdateStabilityEstimate(isAimingDrawn);
            ApplySteadyAimJitterDamping(tension, isAimingDrawn);
            ApplyCameraBreatheAndFocus(tension, isAimingDrawn);
        }

        private void UpdateStabilityEstimate(bool isAimingDrawn)
        {
            if (bowAimPivot == null) return;

            if (!_initialized)
            {
                _filteredAimRotation = bowAimPivot.rotation;
                _lastRawAimRotation = bowAimPivot.rotation;
                _initialized = true;
            }

            float angularDeltaDeg = Quaternion.Angle(_lastRawAimRotation, bowAimPivot.rotation);
            float angSpeedDeg = angularDeltaDeg / Mathf.Max(0.001f, Time.deltaTime);
            _lastRawAimRotation = bowAimPivot.rotation;

            // Rapid wrist shake lowers stability; holding steady recovers it cleanly
            float stabilityLoss = Mathf.Clamp01((angSpeedDeg - 6f) / 110f) * jitterPenaltySensitivity * Time.deltaTime;
            float steadyBonus = Input.GetKey(desktopSteadyBreathKey) ? 1.45f : 1.0f;

            float target = isAimingDrawn
                ? Mathf.Clamp01(drawStabilityValue - stabilityLoss + stabilityRecoveryRate * steadyBonus * Time.deltaTime * 0.35f)
                : Mathf.MoveTowards(drawStabilityValue, 1.0f, stabilityRecoveryRate * Time.deltaTime);

            drawStabilityValue = target;
        }

        private void ApplySteadyAimJitterDamping(float tension, bool isAimingDrawn)
        {
            if (bowAimPivot == null) return;

            Quaternion rawRot = bowAimPivot.rotation;
            if (!isAimingDrawn)
            {
                _filteredAimRotation = Quaternion.Slerp(_filteredAimRotation, rawRot, 1f - Mathf.Exp(-relaxedRotSmoothing * Time.deltaTime));
                return;
            }

            // Higher drawTension + higher drawStability = tighter micro-jitter suppression
            float stabilizeWeight = Mathf.Clamp01(tension) * Mathf.Clamp01(drawStabilityValue);
            float smoothRate = Mathf.Lerp(relaxedRotSmoothing, stabilizedRotSmoothing, stabilizeWeight);
            _filteredAimRotation = Quaternion.Slerp(_filteredAimRotation, rawRot, 1f - Mathf.Exp(-smoothRate * Time.deltaTime));
            bowAimPivot.rotation = _filteredAimRotation;
        }

        private void ApplyCameraBreatheAndFocus(float tension, bool isAimingDrawn)
        {
            _breathePhase += Time.deltaTime * breatheCycleHz * Mathf.PI * 2f;

            // Instability amplifies micro-sway; high drawStability dampens it nearly flat
            float instabilityFactor = 1f - Mathf.Clamp01(drawStabilityValue) * 0.82f;
            float swayAmplitude = isAimingDrawn ? tension * instabilityFactor : 0.15f;

            float pitchOffset = Mathf.Sin(_breathePhase) * maxBreathePitchDeg * swayAmplitude;
            float yawOffset = Mathf.Cos(_breathePhase * 0.5f) * maxBreatheYawDeg * swayAmplitude;

            // Apply additive breathe ONLY on an auxiliary offset pivot so OpenXR headset pose never drifts
            if (swayCameraOffsetPivot != null)
            {
                Quaternion targetBreathe = Quaternion.Euler(pitchOffset, yawOffset, 0f);
                swayCameraOffsetPivot.localRotation = Quaternion.Slerp(
                    swayCameraOffsetPivot.localRotation,
                    targetBreathe,
                    1f - Mathf.Exp(-10f * Time.deltaTime)
                );
            }

            // Apply gentle focus FOV narrowing ONLY when not running inside a native stereo XR HMD
            if (fallbackDesktopCamera != null && !XRSettings.isDeviceActive)
            {
                float targetFov = isAimingDrawn
                    ? Mathf.Lerp(normalDesktopFov, drawnFocusFov, tension * drawStabilityValue)
                    : normalDesktopFov;
                fallbackDesktopCamera.fieldOfView = Mathf.Lerp(
                    fallbackDesktopCamera.fieldOfView,
                    targetFov,
                    1f - Mathf.Exp(-fovLerpSpeed * Time.deltaTime)
                );
            }
        }
    }
}`,
  },
  {
    id: 'impact-particle-manager',
    fileName: 'ImpactParticleManager.cs',
    className: 'ImpactParticleManager : MonoBehaviour',
    roleSummary:
      'Detects projectile collisions (OnCollisionEnter & RaycastHit hooks) and spawns material-specific ImpactEffect prefabs—metallic sparks, wood splinters, or stone dust—at exact contact normals.',
    keyHighlights: [
      'Works both attached to projectile prefabs (OnCollisionEnter ContactPoint) and as a scene singleton invoked from VRArrowProjectile continuous raycasts',
      'Resolves SurfaceMaterialTag, EnemyHitboxZone, or collider tags (Metal/Wood/Stone) to pick Sparks, Wood Splinters, or Stone Dust prefabs',
      'Includes an object-pooled Queue per material plus procedural particle burst fallback if Inspector prefabs are left unassigned',
    ],
    code: `using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    [Serializable]
    public struct ImpactEffectEntry
    {
        public SurfaceMaterialType materialType;
        [Tooltip("ImpactEffect prefab (sparks for Metal, splinters for Wood, dust for Stone)")]
        public GameObject impactEffectPrefab;
        public Color fallbackBurstColor;
        [Range(0.5f, 5f)] public float autoCleanupDelaySeconds;
    }

    /// <summary>
    /// Detects collision events on projectiles (or receives RaycastHit impacts from VRArrowProjectile)
    /// and spawns surface-specific ImpactEffect prefabs oriented to the exact contact point & normal.
    /// </summary>
    public class ImpactParticleManager : MonoBehaviour
    {
        public static ImpactParticleManager Instance { get; private set; }

        [Header("Material ImpactEffect Prefabs")]
        [SerializeField] private ImpactEffectEntry metalSparksEffect = new ImpactEffectEntry
        {
            materialType = SurfaceMaterialType.Metal,
            fallbackBurstColor = new Color(1.0f, 0.86f, 0.25f, 1f),
            autoCleanupDelaySeconds = 1.6f
        };

        [SerializeField] private ImpactEffectEntry woodSplintersEffect = new ImpactEffectEntry
        {
            materialType = SurfaceMaterialType.Wood,
            fallbackBurstColor = new Color(0.85f, 0.56f, 0.20f, 1f),
            autoCleanupDelaySeconds = 1.6f
        };

        [SerializeField] private ImpactEffectEntry stoneDustEffect = new ImpactEffectEntry
        {
            materialType = SurfaceMaterialType.Stone,
            fallbackBurstColor = new Color(0.68f, 0.72f, 0.78f, 1f),
            autoCleanupDelaySeconds = 1.8f
        };

        [Header("Projectile Collision Detection (When Attached to Projectile Prefab)")]
        [SerializeField] private bool listenToPhysicsCollisions = true;
        [SerializeField] private float minCollisionSpeedMs = 3.0f;
        [SerializeField] private float surfaceNormalOffset = 0.015f;

        private readonly Dictionary<SurfaceMaterialType, Queue<GameObject>> _effectPools =
            new Dictionary<SurfaceMaterialType, Queue<GameObject>>(3);
        private Material _fallbackParticleMat;

        private void Awake()
        {
            if (Instance == null) Instance = this;
        }

        private void OnDisable()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Automatically detects Unity Rigidbody/Collider contact events when placed on a projectile prefab.
        /// </summary>
        private void OnCollisionEnter(Collision collision)
        {
            if (!listenToPhysicsCollisions || collision == null || collision.contactCount == 0) return;
            if (collision.relativeVelocity.magnitude < minCollisionSpeedMs) return;

            ContactPoint contact = collision.GetContact(0);
            SurfaceMaterialType resolvedMat = ResolveMaterial(collision.collider);
            SpawnImpactEffect(resolvedMat, contact.point, contact.normal);
        }

        /// <summary>
        /// Called by continuous-raycast arrows (VRArrowProjectile) on surface hit.
        /// </summary>
        public void SpawnImpactFromRaycastHit(RaycastHit hit)
        {
            if (hit.collider == null) return;
            SurfaceMaterialType resolvedMat = ResolveMaterial(hit.collider);
            SpawnImpactEffect(resolvedMat, hit.point, hit.normal);
        }

        public SurfaceMaterialType ResolveMaterial(Collider col)
        {
            if (col == null) return SurfaceMaterialType.Wood;

            // Armored warrior hitboxes trigger metallic sparks
            if (col.GetComponentInParent<EnemyHitboxZone>() != null)
            {
                return SurfaceMaterialType.Metal;
            }

            PenetrableSurfaceOverride penOverride = col.GetComponentInParent<PenetrableSurfaceOverride>();
            if (penOverride != null) return penOverride.surfaceMaterial;

            SurfaceMaterialTag tag = col.GetComponentInParent<SurfaceMaterialTag>();
            if (tag != null) return tag.materialType;

            // Fallback string tag / material name match
            if (col.CompareTag("Metal") || col.CompareTag("Shield") || col.CompareTag("Armor"))
                return SurfaceMaterialType.Metal;
            if (col.CompareTag("Stone"))
                return SurfaceMaterialType.Stone;

            return SurfaceMaterialType.Wood;
        }

        public void SpawnImpactEffect(SurfaceMaterialType materialType, Vector3 contactPoint, Vector3 contactNormal)
        {
            ImpactEffectEntry entry = materialType switch
            {
                SurfaceMaterialType.Metal => metalSparksEffect,
                SurfaceMaterialType.Stone => stoneDustEffect,
                _ => woodSplintersEffect
            };

            Vector3 normalDir = contactNormal.sqrMagnitude > 0.001f ? contactNormal.normalized : Vector3.up;
            Vector3 spawnPos = contactPoint + normalDir * surfaceNormalOffset;
            Quaternion spawnRot = Quaternion.LookRotation(normalDir);

            if (entry.impactEffectPrefab != null)
            {
                GameObject instance = AcquirePooledOrInstantiate(materialType, entry.impactEffectPrefab, spawnPos, spawnRot);
                StartCoroutine(ReturnToPoolAfterDelay(materialType, instance, Mathf.Max(0.4f, entry.autoCleanupDelaySeconds)));
            }
            else
            {
                SpawnProceduralBurst(materialType, entry.fallbackBurstColor, spawnPos, spawnRot);
            }
        }

        private GameObject AcquirePooledOrInstantiate(SurfaceMaterialType type, GameObject prefab, Vector3 pos, Quaternion rot)
        {
            if (_effectPools.TryGetValue(type, out Queue<GameObject> pool) && pool.Count > 0)
            {
                GameObject recycled = pool.Dequeue();
                if (recycled != null)
                {
                    recycled.transform.SetPositionAndRotation(pos, rot);
                    recycled.SetActive(true);
                    ParticleSystem ps = recycled.GetComponentInChildren<ParticleSystem>();
                    if (ps != null) ps.Play(true);
                    return recycled;
                }
            }

            return Instantiate(prefab, pos, rot);
        }

        private IEnumerator ReturnToPoolAfterDelay(SurfaceMaterialType type, GameObject instance, float delay)
        {
            yield return new WaitForSeconds(delay);
            if (instance == null) yield break;

            instance.SetActive(false);
            if (!_effectPools.TryGetValue(type, out Queue<GameObject> pool))
            {
                pool = new Queue<GameObject>(8);
                _effectPools[type] = pool;
            }
            pool.Enqueue(instance);
        }

        private void SpawnProceduralBurst(SurfaceMaterialType matType, Color tint, Vector3 pos, Quaternion rot)
        {
            GameObject go = new GameObject($"Impact_{matType}_FX");
            go.transform.SetPositionAndRotation(pos, rot);

            ParticleSystem ps = go.AddComponent<ParticleSystem>();
            ParticleSystem.MainModule main = ps.main;
            main.duration = 0.35f;
            main.loop = false;
            main.startLifetime = matType == SurfaceMaterialType.Stone ? 0.65f : 0.38f;
            main.startSpeed = matType == SurfaceMaterialType.Metal ? 5.2f : (matType == SurfaceMaterialType.Wood ? 3.4f : 1.9f);
            main.startSize = matType == SurfaceMaterialType.Stone ? 0.14f : 0.055f;
            main.startColor = tint;
            main.gravityModifier = matType == SurfaceMaterialType.Stone ? -0.05f : 0.9f;

            ParticleSystem.EmissionModule emission = ps.emission;
            emission.enabled = true;
            emission.rateOverTime = 0f;
            emission.SetBursts(new[] { new ParticleSystem.Burst(0f, matType == SurfaceMaterialType.Metal ? (short)18 : (short)14) });

            ParticleSystem.ShapeModule shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = matType == SurfaceMaterialType.Stone ? 52f : 34f;
            shape.radius = 0.02f;

            ParticleSystemRenderer renderer = go.GetComponent<ParticleSystemRenderer>();
            if (renderer != null)
            {
                if (_fallbackParticleMat == null)
                {
                    Shader shader = Shader.Find("Universal Render Pipeline/Particles/Unlit") ?? Shader.Find("Particles/Standard Unlit");
                    _fallbackParticleMat = new Material(shader);
                }
                renderer.sharedMaterial = _fallbackParticleMat;
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }

            ps.Play();
            Destroy(go, 1.2f);
        }
    }
}`,
  },
  {
    id: 'enemy-pathfinding',
    fileName: 'EnemyPathfinding.cs',
    className: 'EnemyPathfinding : MonoBehaviour',
    roleSummary:
      'NavMesh waypoint pathfinder with a Moving, Attacking, and Fleeing state machine driven by player proximity to the safety wall and enemy health thresholds.',
    keyHighlights: [
      'Navigates pre-defined Transform[] waypoint routes via NavMeshAgent with Loop, PingPong, and Clamp traversal modes',
      'Evaluates player distance to the safety wall center/threshold to transition dynamically between Moving, Attacking, and Fleeing',
      'Validates NavMesh flee targets using NavMesh.SamplePosition away from the safety wall and player before resuming patrol',
    ],
    code: `using System;
using UnityEngine;
using UnityEngine.AI;

namespace MetaQuestArchery
{
    [RequireComponent(typeof(NavMeshAgent))]
    public class EnemyPathfinding : MonoBehaviour
    {
        public enum PathfindingState
        {
            Moving,
            Attacking,
            Fleeing
        }

        public enum RouteTraversalMode
        {
            Loop,
            PingPong,
            StopAtEnd
        }

        [Header("NavMesh Waypoint Path")]
        [SerializeField] private Transform[] waypoints;
        [SerializeField] private RouteTraversalMode traversalMode = RouteTraversalMode.Loop;
        [SerializeField] private float waypointTolerance = 0.85f;
        [SerializeField] private float patrolSpeed = 2.4f;
        [SerializeField] private float chaseSpeed = 3.8f;
        [SerializeField] private float fleeSpeed = 4.6f;

        [Header("Safety Wall & Proximity Rules")]
        [Tooltip("Center Transform of the player's safety wall fortification.")]
        [SerializeField] private Transform safetyWallAnchor;
        [Tooltip("Fallback world Z threshold used if no safetyWallAnchor Transform is assigned.")]
        [SerializeField] private float safetyWallZThreshold = -3.45f;
        [Tooltip("Player within this distance of the safety wall counts as 'inside/at safety wall'.")]
        [SerializeField] private float playerSafetyWallProximity = 4.5f;
        [Tooltip("Max distance from NPC to detect and engage the player.")]
        [SerializeField] private float aggroRange = 18.0f;
        [SerializeField] private float attackRange = 2.1f;

        [Header("Fleeing & Retreat Parameters")]
        [Tooltip("Switch to Fleeing when player is entrenched at the safety wall and NPC HP drops below this ratio.")]
        [Range(0.05f, 1f)]
        [SerializeField] private float fleeHealthRatio = 0.35f;
        [Tooltip("If enabled, unit breaks off and flees immediately whenever the player reaches the safety wall zone.")]
        [SerializeField] private bool fleeWheneverPlayerAtSafetyWall = false;
        [SerializeField] private float fleeDistance = 12.0f;
        [SerializeField] private float safeRecoverDistance = 22.0f;
        [SerializeField] private Transform retreatBeacon;

        [Header("Combat & References")]
        [SerializeField] private Transform playerTarget;
        [SerializeField] private PlayerHealthDiegeticUI playerHealth;
        [SerializeField] private float attackDamage = 12f;
        [SerializeField] private float attackCooldown = 1.8f;
        [SerializeField] private float maxHealth = 120f;
        [SerializeField] private Animator animator;

        private NavMeshAgent _agent;
        private PathfindingState _currentState = PathfindingState.Moving;
        private int _waypointIndex;
        private int _pingPongDirection = 1;
        private float _attackTimer;
        private float _currentHp;
        private float _repathTimer;
        private Vector3 _activeFleeDestination;

        public PathfindingState CurrentState => _currentState;
        public event Action<PathfindingState, PathfindingState> OnStateChanged;

        private void Awake()
        {
            _agent = GetComponent<NavMeshAgent>();
            _currentHp = maxHealth;

            if (playerTarget == null && Camera.main != null)
            {
                playerTarget = Camera.main.transform;
            }
        }

        private void Start()
        {
            TransitionTo(PathfindingState.Moving);
            AssignCurrentWaypointDestination();
        }

        private void Update()
        {
            if (!_agent.isOnNavMesh || playerTarget == null) return;

            EvaluateStateTransitions();

            switch (_currentState)
            {
                case PathfindingState.Moving:
                    TickMovingState();
                    break;
                case PathfindingState.Attacking:
                    TickAttackingState();
                    break;
                case PathfindingState.Fleeing:
                    TickFleeingState();
                    break;
            }
        }

        private void EvaluateStateTransitions()
        {
            float distToPlayer = Vector3.Distance(transform.position, playerTarget.position);
            bool playerNearSafetyWall = IsPlayerNearSafetyWall();
            bool lowHealth = (_currentHp / Mathf.Max(1f, maxHealth)) <= fleeHealthRatio;

            // Fleeing triggers when player leverages the safety wall (either directly configured or combined with low HP)
            bool shouldFlee = playerNearSafetyWall && (fleeWheneverPlayerAtSafetyWall || lowHealth);

            if (_currentState == PathfindingState.Fleeing)
            {
                if (!playerNearSafetyWall && !lowHealth && distToPlayer >= safeRecoverDistance)
                {
                    TransitionTo(PathfindingState.Moving);
                }
                return;
            }

            if (shouldFlee && distToPlayer <= safeRecoverDistance)
            {
                TransitionTo(PathfindingState.Fleeing);
                return;
            }

            if (_currentState == PathfindingState.Moving)
            {
                // Attacking engages when player steps into aggro range (and is vulnerable / outside wall breach threshold)
                if (distToPlayer <= aggroRange)
                {
                    TransitionTo(PathfindingState.Attacking);
                }
            }
            else if (_currentState == PathfindingState.Attacking)
            {
                if (distToPlayer > aggroRange * 1.25f)
                {
                    TransitionTo(PathfindingState.Moving);
                }
            }
        }

        private bool IsPlayerNearSafetyWall()
        {
            if (playerTarget == null) return false;

            if (safetyWallAnchor != null)
            {
                float distToWall = Vector3.Distance(playerTarget.position, safetyWallAnchor.position);
                return distToWall <= playerSafetyWallProximity;
            }

            // Fallback check using arena Z safety-wall boundary
            return playerTarget.position.z >= safetyWallZThreshold;
        }

        private void TransitionTo(PathfindingState nextState)
        {
            if (_currentState == nextState && Application.isPlaying && _agent != null)
            {
                // Allow initial Start() setup
            }

            PathfindingState prev = _currentState;
            _currentState = nextState;

            switch (nextState)
            {
                case PathfindingState.Moving:
                    _agent.isStopped = false;
                    _agent.speed = patrolSpeed;
                    _agent.stoppingDistance = Mathf.Max(0.15f, waypointTolerance * 0.5f);
                    AssignCurrentWaypointDestination();
                    animator?.SetBool("IsMoving", true);
                    animator?.SetBool("IsFleeing", false);
                    break;

                case PathfindingState.Attacking:
                    _agent.isStopped = false;
                    _agent.speed = chaseSpeed;
                    _agent.stoppingDistance = attackRange * 0.85f;
                    _attackTimer = Mathf.Min(_attackTimer, 0.35f);
                    animator?.SetBool("IsMoving", true);
                    animator?.SetBool("IsFleeing", false);
                    break;

                case PathfindingState.Fleeing:
                    _agent.isStopped = false;
                    _agent.speed = fleeSpeed;
                    _agent.stoppingDistance = 0.4f;
                    _repathTimer = 0f;
                    ComputeAndSetFleeDestination();
                    animator?.SetBool("IsMoving", true);
                    animator?.SetBool("IsFleeing", true);
                    break;
            }

            if (prev != nextState)
            {
                OnStateChanged?.Invoke(prev, nextState);
            }
        }

        private void TickMovingState()
        {
            if (waypoints == null || waypoints.Length == 0) return;

            if (!_agent.pathPending && _agent.remainingDistance <= waypointTolerance)
            {
                AdvanceWaypointIndex();
                AssignCurrentWaypointDestination();
            }
        }

        private void TickAttackingState()
        {
            float distToPlayer = Vector3.Distance(transform.position, playerTarget.position);

            if (distToPlayer > attackRange)
            {
                _agent.isStopped = false;
                _repathTimer -= Time.deltaTime;
                if (_repathTimer <= 0f)
                {
                    _repathTimer = 0.15f;
                    _agent.SetDestination(playerTarget.position);
                }
            }
            else
            {
                _agent.isStopped = true;
                FaceTarget(playerTarget.position);

                _attackTimer -= Time.deltaTime;
                if (_attackTimer <= 0f)
                {
                    _attackTimer = attackCooldown;
                    animator?.SetTrigger("Attack");
                    playerHealth?.ApplyDamage(attackDamage, $"{gameObject.name} Strike");
                }
            }
        }

        private void TickFleeingState()
        {
            _repathTimer -= Time.deltaTime;
            if (_repathTimer <= 0f || (!_agent.pathPending && _agent.remainingDistance <= 1.1f))
            {
                _repathTimer = 0.65f;
                ComputeAndSetFleeDestination();
            }
        }

        private void ComputeAndSetFleeDestination()
        {
            if (retreatBeacon != null)
            {
                _activeFleeDestination = retreatBeacon.position;
                _agent.SetDestination(_activeFleeDestination);
                return;
            }

            Vector3 threatOrigin = safetyWallAnchor != null ? safetyWallAnchor.position : playerTarget.position;
            Vector3 awayDir = (transform.position - threatOrigin);
            awayDir.y = 0f;
            if (awayDir.sqrMagnitude < 0.01f)
            {
                awayDir = -Vector3.forward;
            }

            Vector3 candidate = transform.position + awayDir.normalized * fleeDistance;
            if (NavMesh.SamplePosition(candidate, out NavMeshHit hit, 6.0f, NavMesh.AllAreas))
            {
                _activeFleeDestination = hit.position;
                _agent.SetDestination(_activeFleeDestination);
            }
        }

        private void AssignCurrentWaypointDestination()
        {
            if (waypoints == null || waypoints.Length == 0) return;
            Transform targetWp = waypoints[Mathf.Clamp(_waypointIndex, 0, waypoints.Length - 1)];
            if (targetWp != null)
            {
                _agent.SetDestination(targetWp.position);
            }
        }

        private void AdvanceWaypointIndex()
        {
            if (waypoints == null || waypoints.Length <= 1) return;

            switch (traversalMode)
            {
                case RouteTraversalMode.Loop:
                    _waypointIndex = (_waypointIndex + 1) % waypoints.Length;
                    break;

                case RouteTraversalMode.PingPong:
                    int next = _waypointIndex + _pingPongDirection;
                    if (next >= waypoints.Length || next < 0)
                    {
                        _pingPongDirection *= -1;
                        next = _waypointIndex + _pingPongDirection;
                    }
                    _waypointIndex = Mathf.Clamp(next, 0, waypoints.Length - 1);
                    break;

                case RouteTraversalMode.StopAtEnd:
                    _waypointIndex = Mathf.Min(_waypointIndex + 1, waypoints.Length - 1);
                    break;
            }
        }

        private void FaceTarget(Vector3 worldPos)
        {
            Vector3 flatDir = worldPos - transform.position;
            flatDir.y = 0f;
            if (flatDir.sqrMagnitude > 0.001f)
            {
                Quaternion targetRot = Quaternion.LookRotation(flatDir.normalized);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 10f);
            }
        }

        public void ApplyDamage(float amount)
        {
            _currentHp = Mathf.Max(0f, _currentHp - Mathf.Abs(amount));
            if (_currentHp <= 0f)
            {
                _agent.enabled = false;
                enabled = false;
            }
        }

        private void OnDrawGizmosSelected()
        {
            if (waypoints != null && waypoints.Length > 1)
            {
                Gizmos.color = Color.cyan;
                for (int i = 0; i < waypoints.Length - 1; i++)
                {
                    if (waypoints[i] != null && waypoints[i + 1] != null)
                    {
                        Gizmos.DrawLine(waypoints[i].position, waypoints[i + 1].position);
                    }
                }
                if (traversalMode == RouteTraversalMode.Loop && waypoints[0] != null && waypoints[waypoints.Length - 1] != null)
                {
                    Gizmos.DrawLine(waypoints[waypoints.Length - 1].position, waypoints[0].position);
                }
            }

            if (safetyWallAnchor != null)
            {
                Gizmos.color = new Color(1f, 0.6f, 0.1f, 0.65f);
                Gizmos.DrawWireSphere(safetyWallAnchor.position, playerSafetyWallProximity);
            }

            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(transform.position, attackRange);
        }
    }
}`,
  },
  {
    id: 'enemy-wave-controller',
    fileName: 'EnemyWaveController.cs',
    className: 'EnemyWaveController : MonoBehaviour',
    roleSummary:
      'Non-stop enemy wave generator with time-accelerating spawn intervals that halts spawning exclusively when the player crosses the final mission waypoint.',
    keyHighlights: [
      'Continuously spawns weighted enemy prefabs across configurable Transform gates without stopping between waves',
      'Accelerates spawn cadence over mission elapsed time down to a configurable minimum interval floor',
      'Halts generator strictly upon finalMissionWaypoint traversal via radius/plane validation or trigger hook',
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace MetaQuestArchery
{
    public class EnemyWaveController : MonoBehaviour
    {
        [Serializable]
        public struct WeightedEnemyEntry
        {
            public GameObject prefab;
            [Range(0.1f, 10f)]
            public float spawnWeight;
            [Min(1)]
            public int unlockWaveIndex;
        }

        [Header("Non-Stop Wave Roster & Spawn Gates")]
        [SerializeField] private WeightedEnemyEntry[] enemyRoster;
        [SerializeField] private Transform[] spawnGates;
        [SerializeField] private int maxConcurrentActive = 6;
        [SerializeField] private bool startAutomaticallyOnAwake = true;

        [Header("Accelerating Spawn Cadence")]
        [SerializeField] private float initialSpawnInterval = 4.2f;
        [SerializeField] private float minSpawnInterval = 1.05f;
        [Tooltip("Seconds shaved off spawn interval per minute of combat survival.")]
        [SerializeField] private float accelerationPerSecond = 0.045f;
        [SerializeField] private float waveEscalationDuration = 22f;
        [SerializeField] private float interWaveSpeedupBonus = 0.12f;

        [Header("Final Mission Waypoint Gate")]
        [SerializeField] private Transform playerTransform;
        [SerializeField] private PlayerHealthDiegeticUI playerHealth;
        [SerializeField] private Transform finalMissionWaypoint;
        [SerializeField] private float waypointCrossRadius = 2.6f;
        [Tooltip("Optional forward crossing test along finalMissionWaypoint.forward (>= 0 means crossed).")]
        [SerializeField] private bool useDirectionalPlaneCheck = true;

        private readonly List<GameObject> _activeEnemies = new List<GameObject>(16);
        private bool _spawningEnabled;
        private bool _finalWaypointCrossed;
        private float _elapsedMissionTime;
        private float _waveTimer;
        private float _spawnCountdown;
        private int _currentWaveIndex = 1;
        private int _totalSpawnedCount;

        public bool IsSpawningActive => _spawningEnabled && !_finalWaypointCrossed;
        public bool HasCrossedFinalWaypoint => _finalWaypointCrossed;
        public int CurrentWaveIndex => _currentWaveIndex;
        public int TotalSpawnedCount => _totalSpawnedCount;
        public int ActiveAliveCount
        {
            get
            {
                PruneDefeatedEntries();
                return _activeEnemies.Count;
            }
        }
        public float CurrentSpawnInterval => ComputeCurrentSpawnInterval();

        public event Action<int> OnWaveEscalated;
        public event Action<GameObject, int> OnEnemySpawned;
        public event Action OnFinalWaypointCrossed;

        private void Awake()
        {
            if (playerTransform == null && Camera.main != null)
            {
                playerTransform = Camera.main.transform;
            }
        }

        private void Start()
        {
            if (startAutomaticallyOnAwake)
            {
                BeginNonStopWaves();
            }
        }

        public void BeginNonStopWaves()
        {
            _finalWaypointCrossed = false;
            _spawningEnabled = true;
            _elapsedMissionTime = 0f;
            _waveTimer = 0f;
            _currentWaveIndex = 1;
            _totalSpawnedCount = 0;
            _spawnCountdown = 0.35f;
            OnWaveEscalated?.Invoke(_currentWaveIndex);
        }

        private void Update()
        {
            if (!_spawningEnabled || _finalWaypointCrossed) return;

            // Core invariant: enemies ONLY stop spawning when the player crosses the final mission waypoint
            if (EvaluateFinalWaypointCrossed())
            {
                HandleFinalWaypointCrossed();
                return;
            }

            float dt = Time.deltaTime;
            _elapsedMissionTime += dt;
            _waveTimer += dt;

            if (_waveTimer >= waveEscalationDuration)
            {
                _waveTimer -= waveEscalationDuration;
                _currentWaveIndex++;
                OnWaveEscalated?.Invoke(_currentWaveIndex);
            }

            PruneDefeatedEntries();

            if (maxConcurrentActive > 0 && _activeEnemies.Count >= maxConcurrentActive)
            {
                return;
            }

            _spawnCountdown -= dt;
            if (_spawnCountdown <= 0f)
            {
                SpawnNextEnemy();
                _spawnCountdown = ComputeCurrentSpawnInterval();
            }
        }

        private float ComputeCurrentSpawnInterval()
        {
            float timeReduction = _elapsedMissionTime * accelerationPerSecond;
            float waveReduction = Mathf.Max(0, _currentWaveIndex - 1) * interWaveSpeedupBonus;
            float interval = initialSpawnInterval - timeReduction - waveReduction;
            return Mathf.Max(minSpawnInterval, interval);
        }

        private bool EvaluateFinalWaypointCrossed()
        {
            if (finalMissionWaypoint == null || playerTransform == null) return false;

            float planarDist = Vector2.Distance(
                new Vector2(playerTransform.position.x, playerTransform.position.z),
                new Vector2(finalMissionWaypoint.position.x, finalMissionWaypoint.position.z)
            );

            if (planarDist <= waypointCrossRadius)
            {
                return true;
            }

            if (useDirectionalPlaneCheck)
            {
                Vector3 toPlayer = playerTransform.position - finalMissionWaypoint.position;
                toPlayer.y = 0f;
                Vector3 gateForward = finalMissionWaypoint.forward;
                gateForward.y = 0f;
                if (gateForward.sqrMagnitude > 0.001f && Vector3.Dot(toPlayer, gateForward.normalized) >= 0f)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Can also be invoked externally by a TriggerCollider placed on the Extraction / Finishing Line gate.
        /// </summary>
        public void NotifyFinalWaypointCrossed()
        {
            if (_finalWaypointCrossed) return;
            HandleFinalWaypointCrossed();
        }

        private void HandleFinalWaypointCrossed()
        {
            _finalWaypointCrossed = true;
            _spawningEnabled = false;
            OnFinalWaypointCrossed?.Invoke();
        }

        private void SpawnNextEnemy()
        {
            GameObject prefab = SelectWeightedPrefabForWave(_currentWaveIndex);
            if (prefab == null) return;

            Transform gate = SelectSpawnGate();
            Vector3 spawnPos = gate != null ? gate.position : transform.position;
            Quaternion spawnRot = gate != null ? gate.rotation : transform.rotation;

            GameObject instance = Instantiate(prefab, spawnPos, spawnRot);
            _activeEnemies.Add(instance);
            _totalSpawnedCount++;

            ArmoredEnemyAI ai = instance.GetComponent<ArmoredEnemyAI>();
            if (ai != null && playerTransform != null)
            {
                ai.InitializeTarget(playerTransform, playerHealth);
            }

            OnEnemySpawned?.Invoke(instance, _totalSpawnedCount);
        }

        private GameObject SelectWeightedPrefabForWave(int waveIndex)
        {
            if (enemyRoster == null || enemyRoster.Length == 0) return null;

            float totalWeight = 0f;
            for (int i = 0; i < enemyRoster.Length; i++)
            {
                if (enemyRoster[i].prefab != null && waveIndex >= Mathf.Max(1, enemyRoster[i].unlockWaveIndex))
                {
                    totalWeight += Mathf.Max(0.05f, enemyRoster[i].spawnWeight);
                }
            }

            if (totalWeight <= 0f) return enemyRoster[0].prefab;

            float roll = UnityEngine.Random.Range(0f, totalWeight);
            float accum = 0f;
            for (int i = 0; i < enemyRoster.Length; i++)
            {
                WeightedEnemyEntry entry = enemyRoster[i];
                if (entry.prefab == null || waveIndex < Mathf.Max(1, entry.unlockWaveIndex)) continue;
                accum += Mathf.Max(0.05f, entry.spawnWeight);
                if (roll <= accum) return entry.prefab;
            }

            return enemyRoster[0].prefab;
        }

        private Transform SelectSpawnGate()
        {
            if (spawnGates == null || spawnGates.Length == 0) return null;
            int idx = UnityEngine.Random.Range(0, spawnGates.Length);
            return spawnGates[idx];
        }

        private void PruneDefeatedEntries()
        {
            for (int i = _activeEnemies.Count - 1; i >= 0; i--)
            {
                GameObject go = _activeEnemies[i];
                if (go == null)
                {
                    _activeEnemies.RemoveAt(i);
                    continue;
                }

                ArmoredEnemyAI ai = go.GetComponent<ArmoredEnemyAI>();
                if (ai != null && ai.IsDefeated)
                {
                    _activeEnemies.RemoveAt(i);
                }
            }
        }

        private void OnDrawGizmosSelected()
        {
            if (finalMissionWaypoint != null)
            {
                Gizmos.color = Color.green;
                Gizmos.DrawWireSphere(finalMissionWaypoint.position, waypointCrossRadius);
                Gizmos.DrawRay(finalMissionWaypoint.position, finalMissionWaypoint.forward * 3.5f);
            }

            if (spawnGates != null)
            {
                Gizmos.color = Color.yellow;
                for (int i = 0; i < spawnGates.Length; i++)
                {
                    if (spawnGates[i] != null)
                    {
                        Gizmos.DrawWireCube(spawnGates[i].position, new Vector3(1.1f, 2.0f, 1.1f));
                    }
                }
            }
        }
    }
}`,
  },
  {
    id: 'vr-haptic-controller',
    fileName: 'VrHapticController.cs',
    className: 'VrHapticController : MonoBehaviour',
    roleSummary:
      'Triggers XR Interaction Toolkit controller vibration impulses when the bow reaches full draw tension or when an arrow strikes an enemy.',
    keyHighlights: [
      'Uses UnityEngine.XR.Interaction.Toolkit XRBaseController.SendHapticImpulse (plus optional XRI 3.x HapticImpulsePlayer fallback) for left/right controllers',
      'Edge-triggered full-draw lock-in vibration with hysteresis re-arming (0.98f lock / 0.85f re-arm) synced to VRBowController.NormalizedTension',
      'Distinct enemy-hit haptic patterns: punchy body hit, metallic shield deflection, and double-tap confirmation coroutine for critical headshots/kills',
    ],
    code: `using System.Collections;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
#if XRI_3_0_OR_NEWER
using UnityEngine.XR.Interaction.Toolkit.Inputs.Haptics;
#endif

namespace MetaQuestArchery
{
    public enum HapticHandTarget
    {
        BowHand = 0,
        StringHand = 1,
        BothHands = 2
    }

    /// <summary>
    /// Central XR Interaction Toolkit haptic feedback controller.
    /// Triggers tactile impulses when the bow hits full draw tension and when arrows hit enemies.
    /// </summary>
    public class VrHapticController : MonoBehaviour
    {
        public static VrHapticController Instance { get; private set; }

        [Header("XR Interaction Toolkit Controllers")]
        [Tooltip("XRBaseController on the left/bow hand (ActionBasedController or XRController).")]
        [SerializeField] private XRBaseController bowHandController;
        [Tooltip("XRBaseController on the right/string hand.")]
        [SerializeField] private XRBaseController stringHandController;

#if XRI_3_0_OR_NEWER
        [Header("XRI 3.x HapticImpulsePlayer (Optional)")]
        [SerializeField] private HapticImpulsePlayer bowHandHapticPlayer;
        [SerializeField] private HapticImpulsePlayer stringHandHapticPlayer;
#endif

        [Header("Bow Draw Integration")]
        [Tooltip("Optional reference to poll bow draw tension automatically each frame.")]
        [SerializeField] private VRBowController bowController;
        [Range(0.85f, 1.0f)]
        [SerializeField] private float fullDrawThreshold = 0.98f;
        [Range(0.50f, 0.94f)]
        [SerializeField] private float drawRearmThreshold = 0.85f;
        [SerializeField] private float fullDrawAmplitude = 0.72f;
        [SerializeField] private float fullDrawDuration = 0.09f;
        [SerializeField] private float bowHandDrawScale = 0.65f;

        [Header("Optional Hold Overdraw Feedback")]
        [SerializeField] private bool enableHoldHeartbeat = true;
        [SerializeField] private float holdHeartbeatDelay = 1.15f;
        [SerializeField] private float holdHeartbeatInterval = 0.55f;
        [SerializeField] private float holdHeartbeatAmplitude = 0.22f;
        [SerializeField] private float holdHeartbeatDuration = 0.045f;

        [Header("Enemy Hit Haptic Profiles")]
        [SerializeField] private float bodyHitAmplitude = 0.62f;
        [SerializeField] private float bodyHitDuration = 0.085f;
        [SerializeField] private float criticalHitAmplitude = 0.95f;
        [SerializeField] private float criticalHitDuration = 0.12f;
        [SerializeField] private float criticalFollowupDelay = 0.07f;
        [SerializeField] private float shieldDeflectAmplitude = 0.45f;
        [SerializeField] private float shieldDeflectDuration = 0.055f;
        [SerializeField] private float minHitPulseCooldown = 0.05f;

        private bool _hasTriggeredFullDraw;
        private float _fullDrawHoldTimer;
        private float _nextHeartbeatTime;
        private float _lastEnemyHitTime = -99f;
        private Coroutine _hitPatternCoroutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void Update()
        {
            if (bowController != null)
            {
                EvaluateDrawTension(bowController.NormalizedTension);
            }
        }

        /// <summary>
        /// Evaluates current bow draw ratio (0..1) and fires a crisp lock-in impulse at full draw.
        /// Call directly from custom bow scripts if bowController reference is not assigned.
        /// </summary>
        public void EvaluateDrawTension(float normalizedDraw)
        {
            float clampedDraw = Mathf.Clamp01(normalizedDraw);

            // Edge-triggered full-draw vibration with hysteresis re-arming
            if (!_hasTriggeredFullDraw && clampedDraw >= fullDrawThreshold)
            {
                _hasTriggeredFullDraw = true;
                _fullDrawHoldTimer = 0f;
                _nextHeartbeatTime = holdHeartbeatDelay;
                TriggerFullDrawHaptic();
            }
            else if (_hasTriggeredFullDraw && clampedDraw < drawRearmThreshold)
            {
                ResetDrawState();
            }

            // Optional subtle heartbeat while holding bow at peak tension
            if (enableHoldHeartbeat && _hasTriggeredFullDraw && clampedDraw >= fullDrawThreshold)
            {
                _fullDrawHoldTimer += Time.deltaTime;
                if (_fullDrawHoldTimer >= _nextHeartbeatTime)
                {
                    _nextHeartbeatTime = _fullDrawHoldTimer + holdHeartbeatInterval;
                    SendImpulse(HapticHandTarget.BowHand, holdHeartbeatAmplitude, holdHeartbeatDuration);
                }
            }
        }

        /// <summary>
        /// Explicitly fires the full-draw tactile lock-in vibration on both hands.
        /// </summary>
        public void TriggerFullDrawHaptic()
        {
            SendImpulse(HapticHandTarget.StringHand, fullDrawAmplitude, fullDrawDuration);
            SendImpulse(HapticHandTarget.BowHand, fullDrawAmplitude * bowHandDrawScale, fullDrawDuration * 0.85f);
        }

        /// <summary>
        /// Resets the full-draw latch immediately (for example, right after releasing an arrow).
        /// </summary>
        public void ResetDrawState()
        {
            _hasTriggeredFullDraw = false;
            _fullDrawHoldTimer = 0f;
        }

        /// <summary>
        /// Triggers controller vibration when an arrow strikes an enemy hitbox zone.
        /// </summary>
        public void TriggerEnemyHitHaptic(HitboxZoneType zone = HitboxZoneType.Torso, bool isKill = false)
        {
            if (Time.unscaledTime - _lastEnemyHitTime < minHitPulseCooldown)
            {
                return;
            }
            _lastEnemyHitTime = Time.unscaledTime;

            if (zone == HitboxZoneType.Shield)
            {
                // Crisp metallic deflection thud primarily in the bow hand
                SendImpulse(HapticHandTarget.BowHand, shieldDeflectAmplitude, shieldDeflectDuration);
                return;
            }

            bool isCritical = zone == HitboxZoneType.Head || isKill;
            if (isCritical)
            {
                if (_hitPatternCoroutine != null)
                {
                    StopCoroutine(_hitPatternCoroutine);
                }
                _hitPatternCoroutine = StartCoroutine(PlayCriticalHitPatternRoutine(isKill));
            }
            else
            {
                float zoneScale = zone == HitboxZoneType.Limb ? 0.78f : 1.0f;
                SendImpulse(HapticHandTarget.BothHands, bodyHitAmplitude * zoneScale, bodyHitDuration);
            }
        }

        /// <summary>
        /// Simplified overload for projectile or damage events without a HitboxZoneType reference.
        /// </summary>
        public void TriggerEnemyHitHaptic(bool isCriticalHit, bool isKill = false)
        {
            HitboxZoneType mappedZone = isCriticalHit ? HitboxZoneType.Head : HitboxZoneType.Torso;
            TriggerEnemyHitHaptic(mappedZone, isKill);
        }

        private IEnumerator PlayCriticalHitPatternRoutine(bool isKill)
        {
            // First heavy impact pulse
            SendImpulse(HapticHandTarget.BothHands, criticalHitAmplitude, criticalHitDuration);

            yield return new WaitForSecondsRealtime(criticalFollowupDelay);

            // Second confirmation tap (stronger on lethal elimination)
            float followupAmp = isKill ? Mathf.Clamp01(criticalHitAmplitude * 0.88f) : 0.55f;
            float followupDur = isKill ? 0.085f : 0.055f;
            SendImpulse(HapticHandTarget.BowHand, followupAmp, followupDur);
            _hitPatternCoroutine = null;
        }

        /// <summary>
        /// Dispatches haptic impulses through Unity XR Interaction Toolkit controllers.
        /// </summary>
        public void SendImpulse(HapticHandTarget target, float amplitude, float duration, float frequency = 0f)
        {
            float safeAmp = Mathf.Clamp01(amplitude);
            float safeDur = Mathf.Max(0.01f, duration);

            if (target == HapticHandTarget.BowHand || target == HapticHandTarget.BothHands)
            {
                SendToSingleController(bowHandController, safeAmp, safeDur, frequency
#if XRI_3_0_OR_NEWER
                    , bowHandHapticPlayer
#endif
                );
            }

            if (target == HapticHandTarget.StringHand || target == HapticHandTarget.BothHands)
            {
                SendToSingleController(stringHandController, safeAmp, safeDur, frequency
#if XRI_3_0_OR_NEWER
                    , stringHandHapticPlayer
#endif
                );
            }
        }

        private static void SendToSingleController(
            XRBaseController controller,
            float amplitude,
            float duration,
            float frequency
#if XRI_3_0_OR_NEWER
            , HapticImpulsePlayer hapticPlayer
#endif
        )
        {
#if XRI_3_0_OR_NEWER
            if (hapticPlayer != null)
            {
                hapticPlayer.SendHapticImpulse(amplitude, duration, frequency);
                return;
            }
#endif
            if (controller != null)
            {
                controller.SendHapticImpulse(amplitude, duration);
            }
        }
    }
}`,
  },
  {
    id: 'vr-haptic-and-audio',
    fileName: 'VrHapticAndAudio.cs',
    className: 'VrHapticAndAudio : MonoBehaviour',
    roleSummary:
      'Coordinates pooled 3D spatialized AudioSource playback and XR haptic feedback profiles for distinct bow-string materials and projectile impact surfaces.',
    keyHighlights: [
      'Defines BowStringFeedbackProfile presets (Sinew, BraidedHemp, BraidedKevlar, ArcaneNanofiber) with pitch-ramped creaks, twang resonance, and per-material haptic curves',
      'Maintains a pre-warmed 3D spatial AudioSource pool (spatialBlend = 1.0f, logarithmic rolloff) mapped to SurfaceMaterialType (Metal, Wood, Stone)',
      'Integrates cleanly with VrHapticController (XRBaseController.SendHapticImpulse fallback included) and ImpactParticleManager collider resolution',
    ],
    code: `using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;

namespace MetaQuestArchery
{
    public enum BowStringMaterial
    {
        Sinew = 0,
        BraidedHemp = 1,
        BraidedKevlar = 2,
        ArcaneNanofiber = 3
    }

    [Serializable]
    public struct BowStringFeedbackProfile
    {
        public BowStringMaterial stringMaterial;
        [Header("Spatial Bow Audio Clips")]
        public AudioClip[] drawCreakClips;
        public AudioClip releaseTwangClip;
        public AudioClip fullDrawClickClip;
        [Range(0.5f, 1.8f)] public float basePitch;
        [Range(0.05f, 0.8f)] public float tensionPitchSpan;
        [Range(0.1f, 1f)] public float audioVolume;

        [Header("Haptic Response Scaling")]
        [Range(0.1f, 1.5f)] public float drawTickAmplitude;
        [Range(0.01f, 0.08f)] public float drawTickDuration;
        [Range(0.1f, 1f)] public float releaseKickAmplitude;
        [Range(0.02f, 0.16f)] public float releaseKickDuration;
    }

    [Serializable]
    public struct ImpactSurfaceFeedbackProfile
    {
        public SurfaceMaterialType surfaceMaterial;
        [Header("3D Spatial Impact Audio")]
        public AudioClip[] impactClips;
        [Range(0.1f, 1f)] public float baseVolume;
        [Range(0.6f, 1.5f)] public float minPitch;
        [Range(0.6f, 1.6f)] public float maxPitch;

        [Header("XR Impact Haptic Resonance")]
        [Range(0.05f, 1f)] public float hitHapticAmplitude;
        [Range(0.02f, 0.18f)] public float hitHapticDuration;
        public bool doubleTapResonance;
    }

    /// <summary>
    /// Unified spatialized 3D audio & XR haptic feedback manager for bow-string materials
    /// and arrow impact surfaces (Metal, Wood, Stone).
    /// </summary>
    public class VrHapticAndAudio : MonoBehaviour
    {
        public static VrHapticAndAudio Instance { get; private set; }

        [Header("Active Bow String Configuration")]
        [SerializeField] private BowStringMaterial activeStringMaterial = BowStringMaterial.BraidedKevlar;
        [SerializeField] private Transform bowStringAudioAnchor;
        [SerializeField] private AudioSource bowAudioSource;

        [Header("Optional Direct XR Controller Fallbacks")]
        [SerializeField] private XRBaseController bowHandController;
        [SerializeField] private XRBaseController stringHandController;

        [Header("Bow-String Material Profiles")]
        [SerializeField] private BowStringFeedbackProfile[] bowStringProfiles =
        {
            new BowStringFeedbackProfile
            {
                stringMaterial = BowStringMaterial.Sinew,
                basePitch = 0.86f,
                tensionPitchSpan = 0.28f,
                audioVolume = 0.78f,
                drawTickAmplitude = 0.24f,
                drawTickDuration = 0.028f,
                releaseKickAmplitude = 0.58f,
                releaseKickDuration = 0.095f
            },
            new BowStringFeedbackProfile
            {
                stringMaterial = BowStringMaterial.BraidedHemp,
                basePitch = 0.94f,
                tensionPitchSpan = 0.34f,
                audioVolume = 0.82f,
                drawTickAmplitude = 0.32f,
                drawTickDuration = 0.024f,
                releaseKickAmplitude = 0.64f,
                releaseKickDuration = 0.085f
            },
            new BowStringFeedbackProfile
            {
                stringMaterial = BowStringMaterial.BraidedKevlar,
                basePitch = 1.05f,
                tensionPitchSpan = 0.42f,
                audioVolume = 0.88f,
                drawTickAmplitude = 0.28f,
                drawTickDuration = 0.018f,
                releaseKickAmplitude = 0.76f,
                releaseKickDuration = 0.075f
            },
            new BowStringFeedbackProfile
            {
                stringMaterial = BowStringMaterial.ArcaneNanofiber,
                basePitch = 1.18f,
                tensionPitchSpan = 0.52f,
                audioVolume = 0.92f,
                drawTickAmplitude = 0.38f,
                drawTickDuration = 0.016f,
                releaseKickAmplitude = 0.88f,
                releaseKickDuration = 0.068f
            }
        };

        [Header("Arrow Impact Surface Profiles")]
        [SerializeField] private ImpactSurfaceFeedbackProfile[] surfaceProfiles =
        {
            new ImpactSurfaceFeedbackProfile
            {
                surfaceMaterial = SurfaceMaterialType.Metal,
                baseVolume = 0.95f,
                minPitch = 0.96f,
                maxPitch = 1.18f,
                hitHapticAmplitude = 0.82f,
                hitHapticDuration = 0.095f,
                doubleTapResonance = true
            },
            new ImpactSurfaceFeedbackProfile
            {
                surfaceMaterial = SurfaceMaterialType.Wood,
                baseVolume = 0.85f,
                minPitch = 0.88f,
                maxPitch = 1.08f,
                hitHapticAmplitude = 0.56f,
                hitHapticDuration = 0.075f,
                doubleTapResonance = false
            },
            new ImpactSurfaceFeedbackProfile
            {
                surfaceMaterial = SurfaceMaterialType.Stone,
                baseVolume = 0.90f,
                minPitch = 0.82f,
                maxPitch = 1.02f,
                hitHapticAmplitude = 0.70f,
                hitHapticDuration = 0.085f,
                doubleTapResonance = false
            }
        };

        [Header("Spatial 3D Audio Pool")]
        [SerializeField] private int spatialPoolSize = 14;
        [SerializeField] private float minSpatialDistance = 1.5f;
        [SerializeField] private float maxSpatialDistance = 68f;
        [SerializeField] private float drawTickCooldown = 0.045f;

        private readonly Queue<AudioSource> _spatialAudioPool = new Queue<AudioSource>();
        private readonly Dictionary<BowStringMaterial, BowStringFeedbackProfile> _stringMap =
            new Dictionary<BowStringMaterial, BowStringFeedbackProfile>();
        private readonly Dictionary<SurfaceMaterialType, ImpactSurfaceFeedbackProfile> _surfaceMap =
            new Dictionary<SurfaceMaterialType, ImpactSurfaceFeedbackProfile>();

        private float _lastDrawTickTime = -99f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            RebuildLookupTables();
            InitializeSpatialPool();
            ConfigureBowAudioSource();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void RebuildLookupTables()
        {
            _stringMap.Clear();
            if (bowStringProfiles != null)
            {
                for (int i = 0; i < bowStringProfiles.Length; i++)
                {
                    _stringMap[bowStringProfiles[i].stringMaterial] = bowStringProfiles[i];
                }
            }

            _surfaceMap.Clear();
            if (surfaceProfiles != null)
            {
                for (int i = 0; i < surfaceProfiles.Length; i++)
                {
                    _surfaceMap[surfaceProfiles[i].surfaceMaterial] = surfaceProfiles[i];
                }
            }
        }

        private void ConfigureBowAudioSource()
        {
            if (bowAudioSource == null)
            {
                GameObject anchorGo = bowStringAudioAnchor != null ? bowStringAudioAnchor.gameObject : gameObject;
                bowAudioSource = anchorGo.GetComponent<AudioSource>() ?? anchorGo.AddComponent<AudioSource>();
            }
            bowAudioSource.spatialBlend = 1.0f;
            bowAudioSource.rolloffMode = AudioRolloffMode.Logarithmic;
            bowAudioSource.minDistance = 0.4f;
            bowAudioSource.maxDistance = 18f;
            bowAudioSource.playOnAwake = false;
        }

        private void InitializeSpatialPool()
        {
            for (int i = 0; i < Mathf.Max(4, spatialPoolSize); i++)
            {
                GameObject voiceGo = new GameObject($"SpatialAudioVoice_{i}");
                voiceGo.transform.SetParent(transform, false);
                AudioSource src = voiceGo.AddComponent<AudioSource>();
                src.spatialBlend = 1.0f; // Full 3D HRTF spatialization on Meta Quest
                src.rolloffMode = AudioRolloffMode.Logarithmic;
                src.minDistance = minSpatialDistance;
                src.maxDistance = maxSpatialDistance;
                src.spread = 22f;
                src.playOnAwake = false;
                voiceGo.SetActive(false);
                _spatialAudioPool.Enqueue(src);
            }
        }

        public void SetBowStringMaterial(BowStringMaterial material)
        {
            activeStringMaterial = material;
        }

        /// <summary>
        /// Triggers draw-tension audio creak + string-material ratchet haptic tick while drawing.
        /// </summary>
        public void PlayBowDrawTick(float normalizedTension)
        {
            if (Time.unscaledTime - _lastDrawTickTime < drawTickCooldown) return;
            _lastDrawTickTime = Time.unscaledTime;

            float t = Mathf.Clamp01(normalizedTension);
            BowStringFeedbackProfile profile = GetActiveStringProfile();

            if (bowAudioSource != null && profile.drawCreakClips != null && profile.drawCreakClips.Length > 0)
            {
                AudioClip clip = profile.drawCreakClips[UnityEngine.Random.Range(0, profile.drawCreakClips.Length)];
                if (clip != null)
                {
                    bowAudioSource.pitch = profile.basePitch + t * profile.tensionPitchSpan;
                    bowAudioSource.PlayOneShot(clip, profile.audioVolume * Mathf.Lerp(0.35f, 0.85f, t));
                }
            }

            float amp = Mathf.Clamp01(profile.drawTickAmplitude * Mathf.Lerp(0.45f, 1.15f, t));
            SendHapticBoth(amp, amp * 0.55f, profile.drawTickDuration);
        }

        /// <summary>
        /// Triggers crisp full-draw click audio and tactile string-material lock pulse.
        /// </summary>
        public void PlayFullDrawLockFeedback()
        {
            BowStringFeedbackProfile profile = GetActiveStringProfile();
            if (bowAudioSource != null && profile.fullDrawClickClip != null)
            {
                bowAudioSource.pitch = profile.basePitch + profile.tensionPitchSpan;
                bowAudioSource.PlayOneShot(profile.fullDrawClickClip, profile.audioVolume * 0.9f);
            }

            if (VrHapticController.Instance != null)
            {
                VrHapticController.Instance.TriggerFullDrawHaptic();
            }
            else
            {
                SendHapticBoth(profile.releaseKickAmplitude * 0.8f, profile.releaseKickAmplitude * 0.5f, 0.08f);
            }
        }

        /// <summary>
        /// Fires spatialized bowstring release twang + scaled kick haptic impulse on arrow launch.
        /// </summary>
        public void PlayBowReleaseFeedback(float normalizedTension)
        {
            float t = Mathf.Clamp01(normalizedTension);
            BowStringFeedbackProfile profile = GetActiveStringProfile();

            if (bowAudioSource != null && profile.releaseTwangClip != null)
            {
                bowAudioSource.pitch = profile.basePitch + t * (profile.tensionPitchSpan * 0.7f);
                bowAudioSource.PlayOneShot(profile.releaseTwangClip, profile.audioVolume * Mathf.Lerp(0.55f, 1f, t));
            }

            float kick = Mathf.Clamp01(profile.releaseKickAmplitude * Mathf.Lerp(0.4f, 1f, t));
            SendHapticBoth(kick * 0.72f, kick, profile.releaseKickDuration);
        }

        /// <summary>
        /// Resolves collider material tag and triggers spatialized 3D impact audio + surface haptic profile.
        /// </summary>
        public void TriggerImpactFromRaycastHit(RaycastHit hit, float impactSpeedMs = 45f, bool isCritical = false)
        {
            SurfaceMaterialType surface = ResolveSurfaceMaterial(hit.collider);
            TriggerImpactFeedback(surface, hit.point, impactSpeedMs, isCritical);
        }

        /// <summary>
        /// Plays spatial 3D impact sound at hitPoint and dispatches material-tuned controller haptics.
        /// </summary>
        public void TriggerImpactFeedback(
            SurfaceMaterialType surface,
            Vector3 hitPoint,
            float impactSpeedMs = 45f,
            bool isCritical = false)
        {
            if (!_surfaceMap.TryGetValue(surface, out ImpactSurfaceFeedbackProfile profile))
            {
                profile = new ImpactSurfaceFeedbackProfile
                {
                    surfaceMaterial = surface,
                    baseVolume = 0.85f,
                    minPitch = 0.92f,
                    maxPitch = 1.1f,
                    hitHapticAmplitude = 0.65f,
                    hitHapticDuration = 0.08f,
                    doubleTapResonance = surface == SurfaceMaterialType.Metal
                };
            }

            float speedScale = Mathf.Clamp(impactSpeedMs / 55f, 0.45f, 1.15f);

            // 1. Spatial 3D Audio Trigger at exact contact point
            if (profile.impactClips != null && profile.impactClips.Length > 0)
            {
                AudioClip clip = profile.impactClips[UnityEngine.Random.Range(0, profile.impactClips.Length)];
                if (clip != null)
                {
                    float pitch = UnityEngine.Random.Range(profile.minPitch, profile.maxPitch) * (isCritical ? 1.08f : 1f);
                    PlaySpatialClipAtPoint(clip, hitPoint, profile.baseVolume * speedScale, pitch);
                }
            }

            // 2. Material-Specific XR Haptic Resonance
            if (profile.doubleTapResonance || isCritical)
            {
                StartCoroutine(PlayResonantDoublePulse(
                    Mathf.Clamp01(profile.hitHapticAmplitude * speedScale),
                    profile.hitHapticDuration
                ));
            }
            else
            {
                float amp = Mathf.Clamp01(profile.hitHapticAmplitude * speedScale);
                SendHapticBoth(amp, amp * 0.65f, profile.hitHapticDuration);
            }
        }

        private void PlaySpatialClipAtPoint(AudioClip clip, Vector3 worldPos, float volume, float pitch)
        {
            if (_spatialAudioPool.Count == 0) return;

            AudioSource src = _spatialAudioPool.Dequeue();
            src.transform.position = worldPos;
            src.gameObject.SetActive(true);
            src.clip = clip;
            src.volume = Mathf.Clamp01(volume);
            src.pitch = Mathf.Clamp(pitch, 0.5f, 2f);
            src.Play();
            StartCoroutine(RecycleAudioVoiceAfter(src, (clip.length / Mathf.Max(0.5f, src.pitch)) + 0.05f));
        }

        private IEnumerator RecycleAudioVoiceAfter(AudioSource src, float seconds)
        {
            yield return new WaitForSecondsRealtime(seconds);
            if (src != null)
            {
                src.Stop();
                src.clip = null;
                src.gameObject.SetActive(false);
                _spatialAudioPool.Enqueue(src);
            }
        }

        private IEnumerator PlayResonantDoublePulse(float amplitude, float duration)
        {
            SendHapticBoth(amplitude, amplitude * 0.75f, duration);
            yield return new WaitForSecondsRealtime(0.06f);
            SendHapticBoth(amplitude * 0.52f, amplitude * 0.35f, duration * 0.65f);
        }

        private void SendHapticBoth(float bowAmp, float stringAmp, float duration)
        {
            if (VrHapticController.Instance != null)
            {
                VrHapticController.Instance.SendImpulse(HapticHandTarget.BowHand, bowAmp, duration);
                VrHapticController.Instance.SendImpulse(HapticHandTarget.StringHand, stringAmp, duration);
                return;
            }

            if (bowHandController != null) bowHandController.SendHapticImpulse(Mathf.Clamp01(bowAmp), duration);
            if (stringHandController != null) stringHandController.SendHapticImpulse(Mathf.Clamp01(stringAmp), duration);
        }

        private BowStringFeedbackProfile GetActiveStringProfile()
        {
            if (_stringMap.TryGetValue(activeStringMaterial, out BowStringFeedbackProfile found))
            {
                return found;
            }
            return new BowStringFeedbackProfile
            {
                stringMaterial = activeStringMaterial,
                basePitch = 1f,
                tensionPitchSpan = 0.35f,
                audioVolume = 0.85f,
                drawTickAmplitude = 0.28f,
                drawTickDuration = 0.02f,
                releaseKickAmplitude = 0.72f,
                releaseKickDuration = 0.08f
            };
        }

        private static SurfaceMaterialType ResolveSurfaceMaterial(Collider col)
        {
            if (col == null) return SurfaceMaterialType.Wood;
            if (col.GetComponentInParent<EnemyHitboxZone>() != null) return SurfaceMaterialType.Metal;

            SurfaceMaterialTag tag = col.GetComponentInParent<SurfaceMaterialTag>();
            if (tag != null) return tag.materialType;

            if (col.CompareTag("Metal") || col.CompareTag("Shield") || col.CompareTag("Armor"))
                return SurfaceMaterialType.Metal;
            if (col.CompareTag("Stone"))
                return SurfaceMaterialType.Stone;

            return SurfaceMaterialType.Wood;
        }
    }
}`,
  },
  {
    id: 'bow-stamina-controller',
    fileName: 'BowStaminaController.cs',
    className: 'BowStaminaController : MonoBehaviour',
    roleSummary:
      'Manages a VR diegetic bow stamina bar that drains proportionally to draw tension, regenerates after release, and dynamically scales aim stability and arrow draw speed.',
    keyHighlights: [
      'Drains stamina proportionally to VRBowController.NormalizedTension and regenerates smoothly after a post-release recovery delay with exhaustion hysteresis',
      'Drives BowScopeStabilizer.SetDrawStability plus optional fatigue arm tremor and warning XR haptics via VrHapticController when stamina runs low',
      'Exposes CurrentDrawSpeedMultiplier (1.0x -> 0.48x) and ComputeDampedDrawDistance helper alongside world-space Image/Slider stamina bar UI',
    ],
    code: `using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace MetaQuestArchery
{
    /// <summary>
    /// VR Bow Stamina System: drains stamina while holding a drawn bowstring,
    /// replenishes over time after release, and degrades aim stability & arrow draw speed when fatigued.
    /// </summary>
    public class BowStaminaController : MonoBehaviour
    {
        [Header("Core References")]
        [SerializeField] private VRBowController bowController;
        [SerializeField] private BowScopeStabilizer scopeStabilizer;
        [Tooltip("Optional auxiliary pivot on the bow grip riser to apply arm-fatigue micro-tremor without touching headset pose.")]
        [SerializeField] private Transform bowArmTremorPivot;

        [Header("Stamina Pool & Drain/Regen Rates")]
        [SerializeField] private float maxStamina = 100f;
        [SerializeField] private float minDrawThreshold = 0.14f;
        [SerializeField] private float lightDrawDrainPerSec = 7.5f;
        [SerializeField] private float fullDrawDrainPerSec = 22.0f;
        [SerializeField] private float regenPerSec = 18.5f;
        [SerializeField] private float regenDelaySeconds = 0.65f;
        [Range(0.10f, 0.50f)]
        [SerializeField] private float exhaustionRecoverThreshold = 0.25f;

        [Header("Impact on VR Aim Stability & Draw Speed")]
        [Range(0.15f, 1.0f)]
        [SerializeField] private float minAimStabilityAtEmpty = 0.20f;
        [Range(0.30f, 1.0f)]
        [SerializeField] private float minDrawSpeedMultiplier = 0.48f;
        [SerializeField] private float maxArmTremorDeg = 1.65f;
        [SerializeField] private float armTremorFrequencyHz = 7.5f;

        [Header("Low Stamina XR Haptic Warning")]
        [Range(0.05f, 0.40f)]
        [SerializeField] private float lowStaminaWarningRatio = 0.25f;
        [SerializeField] private float warningHapticInterval = 0.38f;
        [SerializeField] private float warningHapticAmplitude = 0.18f;

        [Header("Diegetic Stamina Bar UI (Bow / Wrist World-Space Canvas)")]
        [SerializeField] private Image staminaFillImage;
        [SerializeField] private Slider staminaSlider;
        [SerializeField] private CanvasGroup staminaBarGroup;
        [SerializeField] private Color healthyColor = new Color(0.13f, 0.77f, 0.37f, 1f);
        [SerializeField] private Color strainedColor = new Color(0.96f, 0.62f, 0.04f, 1f);
        [SerializeField] private Color exhaustedColor = new Color(0.94f, 0.27f, 0.27f, 1f);

        [Header("Events")]
        public UnityEvent<float> onStaminaNormalizedChanged;
        public UnityEvent<float> onDrawSpeedMultiplierChanged;

        private float _currentStamina;
        private float _regenCooldownTimer;
        private float _tremorPhase;
        private float _nextWarningHapticTime;
        private float _externalDrawTension = -1f;
        private bool _isExhausted;

        public float CurrentStamina => _currentStamina;
        public float NormalizedStamina => maxStamina > 0f ? Mathf.Clamp01(_currentStamina / maxStamina) : 0f;
        public bool IsExhausted => _isExhausted;

        /// <summary>
        /// Aim stability scalar (minAimStabilityAtEmpty..1.0) fed directly to BowScopeStabilizer.
        /// </summary>
        public float AimStabilityMultiplier { get; private set; } = 1f;

        /// <summary>
        /// Draw speed scalar (minDrawSpeedMultiplier..1.0) slowing bowstring pull rate under fatigue.
        /// </summary>
        public float CurrentDrawSpeedMultiplier { get; private set; } = 1f;

        private void Awake()
        {
            _currentStamina = maxStamina;
            RecalculatePerformanceScalars(0f);
            UpdateStaminaBarUI(true);
        }

        private void Update()
        {
            float tension = ResolveCurrentDrawTension();
            bool isDrawing = tension >= minDrawThreshold;

            UpdateStaminaPool(tension, isDrawing, Time.deltaTime);
            RecalculatePerformanceScalars(tension);
            ApplyStabilityAndTremor(tension, isDrawing, Time.deltaTime);
            UpdateStaminaBarUI(false);

            if (isDrawing)
            {
                MaybeTriggerExhaustionTrembleHaptic();
            }
        }

        /// <summary>
        /// Optional hook if a custom bow script drives tension instead of VRBowController.
        /// Pass -1 to resume reading VRBowController.NormalizedTension automatically.
        /// </summary>
        public void SetExternalDrawTension(float normalizedTension)
        {
            _externalDrawTension = normalizedTension < 0f ? -1f : Mathf.Clamp01(normalizedTension);
        }

        /// <summary>
        /// Smoothly limits bowstring draw velocity based on current fatigue state.
        /// Call from custom XR bow draw logic to enforce slower pulls while fatigued.
        /// </summary>
        public float ComputeFatiguedDrawDistance(
            float currentDrawDistance,
            float targetHandPullDistance,
            float maxDrawDistance,
            float deltaTime)
        {
            float clampedTarget = Mathf.Clamp(targetHandPullDistance, 0f, maxDrawDistance);
            if (clampedTarget <= currentDrawDistance)
            {
                // Relaxing the bowstring is never slowed down
                return clampedTarget;
            }

            float maxPullRate = Mathf.Lerp(0.45f, 3.2f, CurrentDrawSpeedMultiplier);
            return Mathf.MoveTowards(currentDrawDistance, clampedTarget, maxPullRate * deltaTime);
        }

        public void RefillStaminaInstant()
        {
            _currentStamina = maxStamina;
            _isExhausted = false;
            _regenCooldownTimer = 0f;
            RecalculatePerformanceScalars(0f);
            UpdateStaminaBarUI(true);
        }

        private float ResolveCurrentDrawTension()
        {
            if (_externalDrawTension >= 0f) return _externalDrawTension;
            return bowController != null ? Mathf.Clamp01(bowController.NormalizedTension) : 0f;
        }

        private void UpdateStaminaPool(float tension, bool isDrawing, float dt)
        {
            float prevNorm = NormalizedStamina;

            if (isDrawing)
            {
                // Higher draw tension burns noticeably more shoulder & draw-arm stamina
                float normalizedPull = Mathf.InverseLerp(minDrawThreshold, 1f, tension);
                float drainRate = Mathf.Lerp(lightDrawDrainPerSec, fullDrawDrainPerSec, normalizedPull * normalizedPull);
                _currentStamina = Mathf.Max(0f, _currentStamina - drainRate * dt);
                _regenCooldownTimer = regenDelaySeconds;

                if (_currentStamina <= 0.01f)
                {
                    _isExhausted = true;
                }
            }
            else
            {
                if (_regenCooldownTimer > 0f)
                {
                    _regenCooldownTimer = Mathf.Max(0f, _regenCooldownTimer - dt);
                }
                else if (_currentStamina < maxStamina)
                {
                    _currentStamina = Mathf.Min(maxStamina, _currentStamina + regenPerSec * dt);
                    if (_isExhausted && NormalizedStamina >= exhaustionRecoverThreshold)
                    {
                        _isExhausted = false;
                    }
                }
            }

            float nextNorm = NormalizedStamina;
            if (!Mathf.Approximately(prevNorm, nextNorm))
            {
                onStaminaNormalizedChanged?.Invoke(nextNorm);
            }
        }

        private void RecalculatePerformanceScalars(float tension)
        {
            float staminaRatio = NormalizedStamina;
            float prevDrawSpeed = CurrentDrawSpeedMultiplier;

            // Smooth S-curve: full precision above 55% stamina, steeper penalty below 45% or while exhausted
            float smoothFactor = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.05f, 0.65f, staminaRatio));
            float exhaustedPenalty = _isExhausted ? 0.72f : 1.0f;

            AimStabilityMultiplier = Mathf.Clamp01(
                Mathf.Lerp(minAimStabilityAtEmpty, 1.0f, smoothFactor) * exhaustedPenalty
            );

            CurrentDrawSpeedMultiplier = Mathf.Clamp(
                Mathf.Lerp(minDrawSpeedMultiplier, 1.0f, smoothFactor) * (_isExhausted ? 0.85f : 1.0f),
                minDrawSpeedMultiplier * 0.75f,
                1.0f
            );

            if (!Mathf.Approximately(prevDrawSpeed, CurrentDrawSpeedMultiplier))
            {
                onDrawSpeedMultiplierChanged?.Invoke(CurrentDrawSpeedMultiplier);
            }
        }

        private void ApplyStabilityAndTremor(float tension, bool isDrawing, float dt)
        {
            if (scopeStabilizer != null)
            {
                scopeStabilizer.SetDrawStability(AimStabilityMultiplier);
            }

            if (bowArmTremorPivot == null) return;

            if (isDrawing && AimStabilityMultiplier < 0.92f)
            {
                float fatigue = 1f - AimStabilityMultiplier;
                _tremorPhase += dt * armTremorFrequencyHz * Mathf.PI * 2f;

                float pitchJitter = Mathf.Sin(_tremorPhase * 1.13f) * maxArmTremorDeg * fatigue * tension;
                float yawJitter = Mathf.Cos(_tremorPhase * 0.87f) * maxArmTremorDeg * 0.75f * fatigue * tension;

                Quaternion targetRot = Quaternion.Euler(pitchJitter, yawJitter, 0f);
                bowArmTremorPivot.localRotation = Quaternion.Slerp(
                    bowArmTremorPivot.localRotation,
                    targetRot,
                    1f - Mathf.Exp(-14f * dt)
                );
            }
            else
            {
                bowArmTremorPivot.localRotation = Quaternion.Slerp(
                    bowArmTremorPivot.localRotation,
                    Quaternion.identity,
                    1f - Mathf.Exp(-10f * dt)
                );
            }
        }

        private void MaybeTriggerExhaustionTrembleHaptic()
        {
            float ratio = NormalizedStamina;
            if (ratio > lowStaminaWarningRatio || VrHapticController.Instance == null) return;

            if (Time.unscaledTime >= _nextWarningHapticTime)
            {
                _nextWarningHapticTime = Time.unscaledTime + warningHapticInterval;
                float severity = 1f - Mathf.InverseLerp(0f, lowStaminaWarningRatio, ratio);
                float amp = Mathf.Clamp01(warningHapticAmplitude * (0.65f + severity * 0.75f));
                VrHapticController.Instance.SendImpulse(HapticHandTarget.BowHand, amp, 0.045f);
            }
        }

        private void UpdateStaminaBarUI(bool immediate)
        {
            float ratio = NormalizedStamina;

            if (staminaSlider != null)
            {
                staminaSlider.value = ratio;
            }

            if (staminaFillImage != null)
            {
                staminaFillImage.fillAmount = ratio;
                Color targetCol = _isExhausted
                    ? exhaustedColor
                    : ratio > 0.5f
                        ? Color.Lerp(strainedColor, healthyColor, (ratio - 0.5f) * 2f)
                        : Color.Lerp(exhaustedColor, strainedColor, ratio * 2f);
                staminaFillImage.color = targetCol;
            }

            if (staminaBarGroup != null)
            {
                float targetAlpha = ratio < 0.995f ? 1f : 0f;
                staminaBarGroup.alpha = immediate
                    ? targetAlpha
                    : Mathf.MoveTowards(staminaBarGroup.alpha, targetAlpha, Time.deltaTime * 4.5f);
            }
        }
    }
}`,
  },
];
