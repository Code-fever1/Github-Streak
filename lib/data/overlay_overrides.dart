// OverlayOverrides — runtime-editable overlay positions for the hero
// energy scene. Mirrors the dev-mode overlay editor from the Solar RN app.
//
// Stores per-scene overrides for path points, label positions, and icon
// positions. When non-null, the HeroEnergyScene applies these on top of
// the bundled JSON config so changes are visible live.

import '../scene/scene.dart';

/// A single editable position (x, y in viewBox units).
class EditablePoint {
  double x, y;
  EditablePoint(this.x, this.y);

  OverlayPoint toOverlayPoint() => OverlayPoint(x, y);
}

/// Editable label position (x, y, anchor).
class EditableLabel {
  double x, y;
  String anchor;
  EditableLabel(this.x, this.y, this.anchor);

  OverlayLabelPosition toOverlayLabel() => OverlayLabelPosition(x, y, anchor);
}

/// Full editable overlay config for one scene.
class EditableOverlayConfig {
  final HeroSceneId scene;
  final OverlayViewBox viewBox;

  /// Path point lists — each inner list is one wire's polyline.
  final List<EditablePoint> solarPath;
  final List<EditablePoint> gridPath;
  final List<EditablePoint> inverterOutputPath;
  final List<EditablePoint>? gridBypassPath;

  final EditableLabel solarLabel;
  final EditableLabel gridLabel;
  final EditableLabel homeLabel;

  final EditablePoint inverterPos;
  final EditablePoint dbBoxPos;

  EditableOverlayConfig({
    required this.scene,
    required this.viewBox,
    required this.solarPath,
    required this.gridPath,
    required this.inverterOutputPath,
    this.gridBypassPath,
    required this.solarLabel,
    required this.gridLabel,
    required this.homeLabel,
    required this.inverterPos,
    required this.dbBoxPos,
  });

  /// Build from a loaded JSON config.
  factory EditableOverlayConfig.fromConfig(
      HeroSceneId scene, HeroOverlayConfig c) {
    List<EditablePoint> toEdits(List<OverlayPoint> pts) =>
        pts.map((p) => EditablePoint(p.x, p.y)).toList();
    return EditableOverlayConfig(
      scene: scene,
      viewBox: c.viewBox,
      solarPath: toEdits(c.solarPath),
      gridPath: toEdits(c.gridPath),
      inverterOutputPath: toEdits(c.inverterOutputPath),
      gridBypassPath:
          c.gridBypassPath == null ? null : toEdits(c.gridBypassPath!),
      solarLabel:
          EditableLabel(c.solarLabelPosition.x, c.solarLabelPosition.y,
              c.solarLabelPosition.anchor ?? 'left'),
      gridLabel: EditableLabel(c.gridLabelPosition.x, c.gridLabelPosition.y,
          c.gridLabelPosition.anchor ?? 'right'),
      homeLabel: EditableLabel(c.homeLabelPosition.x, c.homeLabelPosition.y,
          c.homeLabelPosition.anchor ?? 'center'),
      inverterPos:
          EditablePoint(c.inverterPosition.x, c.inverterPosition.y),
      dbBoxPos: EditablePoint(c.dbBoxPosition.x, c.dbBoxPosition.y),
    );
  }

  /// Produce a merged HeroOverlayConfig by applying overrides on top of
  /// the given base config.
  HeroOverlayConfig applyTo(HeroOverlayConfig base) {
    List<OverlayPoint> toOverlay(List<EditablePoint> pts) =>
        pts.map((p) => p.toOverlayPoint()).toList();
    return HeroOverlayConfig(
      id: base.id,
      background: base.background,
      viewBox: viewBox,
      solarPath: toOverlay(solarPath),
      gridPath: toOverlay(gridPath),
      inverterOutputPath: toOverlay(inverterOutputPath),
      gridBypassPath:
          gridBypassPath == null ? null : toOverlay(gridBypassPath!),
      solarLabelPosition: solarLabel.toOverlayLabel(),
      gridLabelPosition: gridLabel.toOverlayLabel(),
      homeLabelPosition: homeLabel.toOverlayLabel(),
      inverterPosition: inverterPos.toOverlayPoint(),
      dbBoxPosition: dbBoxPos.toOverlayPoint(),
      wireStyles: base.wireStyles,
    );
  }

  /// Serialize to JSON (for export / clipboard).
  Map<String, dynamic> toJson() {
    List<Map<String, dynamic>> pts(List<EditablePoint> p) =>
        p.map((e) => {'x': e.x.round(), 'y': e.y.round()}).toList();
    return {
      'id': scene.id,
      'viewBox': {'width': viewBox.width, 'height': viewBox.height},
      'solarPath': pts(solarPath),
      'gridPath': pts(gridPath),
      'inverterOutputPath': pts(inverterOutputPath),
      if (gridBypassPath != null) 'gridBypassPath': pts(gridBypassPath!),
      'solarLabelPosition':
          {'x': solarLabel.x.round(), 'y': solarLabel.y.round(), 'anchor': solarLabel.anchor},
      'gridLabelPosition':
          {'x': gridLabel.x.round(), 'y': gridLabel.y.round(), 'anchor': gridLabel.anchor},
      'homeLabelPosition':
          {'x': homeLabel.x.round(), 'y': homeLabel.y.round(), 'anchor': homeLabel.anchor},
      'inverterPosition': {'x': inverterPos.x.round(), 'y': inverterPos.y.round()},
      'dbBoxPosition': {'x': dbBoxPos.x.round(), 'y': dbBoxPos.y.round()},
    };
  }
}
