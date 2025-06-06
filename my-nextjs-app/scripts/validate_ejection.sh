#!/bin/bash
SCREEN_NAME=$1
flutter analyze lib/features/$SCREEN_NAME/presentation/custom/$SCREEN_NAME.dart
flutter test lib/features/$SCREEN_NAME
git diff flutterflow/generated/$SCREEN_NAME.dart lib/features/$SCREEN_NAME/presentation/custom/$SCREEN_NAME.dart > ejection_diff.patch
echo "Ejection validated for $SCREEN_NAME" >> docs/flutterflow_decisions.md
