#!/bin/bash
SCREEN_NAME=$1
mkdir -p lib/features/$SCREEN_NAME/presentation/custom
cp flutterflow/generated/$SCREEN_NAME.dart lib/features/$SCREEN_NAME/presentation/custom/
dart format lib/features/$SCREEN_NAME/presentation/custom/$SCREEN_NAME.dart
sed -i 's/import \'package:flutterflow_ui\/.*\'/import \'package:flutter\/material.dart\'/' \
  lib/features/$SCREEN_NAME/presentation/custom/$SCREEN_NAME.dart
