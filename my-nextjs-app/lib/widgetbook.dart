import 'package:flutter/material.dart';
import 'package:widgetbook/widgetbook.dart';
import 'package:my_app/core/widgets/button.dart'; // Placeholder for button widget

void main() {
  runApp(const WidgetbookApp());
}

class WidgetbookApp extends StatelessWidget {
  const WidgetbookApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Widgetbook.material(
      directories: [
        Directory(
          path: 'UI',
          children: [
            WidgetbookComponent(
              name: 'Button',
              useCases: [
                WidgetbookUseCase(
                  name: 'Primary',
                  builder: (context) => AppButton(
                    text: 'Click Me',
                    onPressed: () {},
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

// Placeholder for AppButton
class AppButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;

  const AppButton({Key? key, required this.text, required this.onPressed}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      child: Text(text),
    );
  }
}
