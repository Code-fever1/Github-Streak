import 'package:flutter/material.dart';

import '../scene/scene.dart';

/// Full-screen scene-tinted gradient background — port of the RN
/// SceneBackground component. Renders the seam→mid→sky gradient used
/// on the home page's scrollable sheet as a full-screen background for
/// any non-home screen.
///
/// Place as the first child of a screen's root Stack (with
/// Positioned.fill) so content scrolls over it.
class SceneBackground extends StatelessWidget {
  final HeroSceneId scene;

  const SceneBackground({super.key, required this.scene});

  @override
  Widget build(BuildContext context) {
    final g = kSceneSheetColors[scene]!;
    final seam = Color.fromARGB(255, g.seam.$1.toInt(), g.seam.$2.toInt(), g.seam.$3.toInt());
    final mid = Color.fromARGB(255, g.mid.$1.toInt(), g.mid.$2.toInt(), g.mid.$3.toInt());
    final sky = Color.fromARGB(255, g.sky.$1.toInt(), g.sky.$2.toInt(), g.sky.$3.toInt());

    return Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: const [0.0, 0.12, 0.32, 1.0],
            colors: [
              seam.withValues(alpha: 0.55),
              seam.withValues(alpha: 0.88),
              mid,
              sky,
            ],
          ),
        ),
      ),
    );
  }
}
