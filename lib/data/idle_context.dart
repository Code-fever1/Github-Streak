// IdleContext — port of the RN IdleContext.
//
// When the user stops interacting with the home dashboard for a while the
// app slips into idle: the hero scene dims, shows a gentle "tap to wake"
// hint, and (when the overlay/lock-screen mode is enabled) cycles through
// the scene wallpapers like a living lock screen. Any interaction wakes it.

import 'dart:async';

import 'package:flutter/material.dart';

import '../scene/scene.dart';

enum IdleStage { awake, drifting, asleep }

class IdleContext extends StatefulWidget {
  final Widget child;
  final Duration idleDelay;

  /// When true the scene wallpapers cycle while idle (overlay mode).
  final bool rotateScenes;
  final void Function(bool idle)? onIdleChange;

  const IdleContext({
    super.key,
    required this.child,
    this.idleDelay = const Duration(seconds: 25),
    this.rotateScenes = false,
    this.onIdleChange,
  });

  @override
  State<IdleContext> createState() => _IdleContextState();
}

class _IdleContextState extends State<IdleContext> {
  IdleStage _stage = IdleStage.awake;
  Timer? _timer;
  Timer? _idleArm;
  int _tick = 0;

  static const _driftingDuration = Duration(milliseconds: 900);
  static const _sceneRotation = Duration(seconds: 10);

  @override
  void initState() {
    super.initState();
    _arm();
  }

  @override
  void didUpdateWidget(IdleContext old) {
    super.didUpdateWidget(old);
    if (old.idleDelay != widget.idleDelay) _arm();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _idleArm?.cancel();
    super.dispose();
  }

  void _arm() {
    _timer?.cancel();
    _idleArm?.cancel();
    _idleArm = Timer(widget.idleDelay, _drift);
  }

  void _drift() {
    if (!mounted) return;
    setState(() => _stage = IdleStage.drifting);
    _tick++;
    Timer(_driftingDuration, () {
      if (!mounted || _stage != IdleStage.drifting) return;
      setState(() => _stage = IdleStage.asleep);
      widget.onIdleChange?.call(true);
      _scheduleRotation();
    });
    // Any tap during drifting wakes immediately.
  }

  void _scheduleRotation() {
    _timer?.cancel();
    if (!widget.rotateScenes || !mounted) return;
    _timer = Timer.periodic(_sceneRotation, (_) {
      if (!mounted || _stage != IdleStage.asleep) {
        _timer?.cancel();
        return;
      }
      setState(() => _tick++);
    });
  }

  void _wake() {
    if (_stage == IdleStage.awake) return;
    _timer?.cancel();
    setState(() => _stage = IdleStage.awake);
    widget.onIdleChange?.call(false);
    _arm();
  }

  /// Active scene index for the rotating-lock-screen mode. Exposes the
  /// cycle counter so callers can pick HeroSceneId.values[_tick % 6].
  int get rotationIndex => _tick;

  HeroSceneId get rotationScene =>
      HeroSceneId.values[_tick % HeroSceneId.values.length];

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _wake(),
      child: Listener(
        onPointerDown: (_) => _wake(),
        child: _IdleScope(stage: _stage, rotation: rotationScene, child: widget.child),
      ),
    );
  }
}

/// Current idle stage for the ambient layer (mirrors RN context use).
IdleStage idleStageOf(BuildContext context) =>
    context.dependOnInheritedWidgetOfExactType<_IdleScope>()?.stage ??
    IdleStage.awake;

/// Active scene during idle rotation (lock-screen mode).
HeroSceneId idleRotationSceneOf(BuildContext context) =>
    context.dependOnInheritedWidgetOfExactType<_IdleScope>()?.rotation ??
    HeroSceneId.night;

class _IdleScope extends InheritedWidget {
  final IdleStage stage;
  final HeroSceneId rotation;
  const _IdleScope({required this.stage, required this.rotation, required super.child});

  @override
  bool updateShouldNotify(_IdleScope old) =>
      old.stage != stage || old.rotation != rotation;
}