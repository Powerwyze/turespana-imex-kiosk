# Camera sentry assets

- Bottle artwork: official Ron Barceló Imperial photo, https://ronbarcelo.com/wp-content/uploads/2021/03/BarceloImperial.png (product photography belongs to Ron Barceló). The image is retained unchanged and used as a Blender material; eye and mouth meshes are original.
- Detector runtime: @mediapipe/tasks-vision 0.10.21, Google MediaPipe, Apache-2.0. https://github.com/google-ai-edge/mediapipe
- Model: EfficientDet-Lite0 int8 v1 from the official model distribution. https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite
- Cloud-test fixture: MediaPipe pose example, https://storage.googleapis.com/mediapipe-assets/pose.jpg. Used only by tests, excluded from Vercel deployment.
